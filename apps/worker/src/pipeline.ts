/**
 * LoCap worker pipeline (spec section 44). Processes a RenderJob through real
 * backend stages: probe → extract → transcribe → analyze → (cut → reframe →
 * captions → render). Every progress update reflects actual backend work.
 */

import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Env, ExportSettings, Transcript } from '@clipx/types';
import { parseGenerationOptions } from '@clipx/types';
import type { Db } from './progress.js';
import { setJob } from './progress.js';
import { transcribeAudio } from './transcribe-audio.js';
import { getTranscriptionProvider, getLLMProvider, convertTranscriptToHinglish } from '@clipx/ai';
import { templateStyle } from '@clipx/captions';
import { buildCaptions, captionsToBurnGroups, DEFAULT_CAPTION_STYLE, captionsToSrt, validateDocument } from '@clipx/captions';
import {
  probeVideo,
  extractThumbnail,
  runFfmpeg,
  extractAudio,
  preprocessSpeechAudio,
  cutClip,
  reframeVideo,
  burnCaptions,
  renderExport,
} from '@clipx/video-engine';
import type { Storage } from '@clipx/storage';

async function tmpWorkspace(jobId: string): Promise<string> {
  return mkdtemp(path.join(tmpdir(), `clipx-${jobId}-`));
}

/** Process a `pipeline` job (upload → transcript → clip suggestions). */
export async function processPipelineJob(
  db: Db,
  env: Env,
  storage: Storage,
  job: { id: string; projectId: string; videoId: string; userId: string; input?: unknown },
): Promise<void> {
  const ws = await tmpWorkspace(job.id);
  try {
    const transcription = getTranscriptionProvider(env);
    const video = await db.video.findFirstOrThrow({ where: { id: job.videoId, projectId: job.projectId, project: { userId: job.userId } } });
    if (!video.sourceKey.startsWith(`users/${job.userId}/`)) throw new Error('Source ownership mismatch');

    // --- PROBE ---
    await setJob(db, job.id, { status: 'probing', progress: 5, message: 'Reading video metadata', error: null });
    const srcPath = await storage.resolveLocal(video.sourceKey);
    const meta = await probeVideo(env, srcPath);
    await db.video.update({
      where: { id: video.id },
      data: { status: 'probing', metadata: JSON.stringify(meta) },
    });

    if (!video.thumbnailKey) {
      try {
        const thumbnail = path.join(ws, 'thumbnail.jpg');
        await extractThumbnail(env, srcPath, thumbnail, meta.duration);
        const thumbnailKey = `users/${job.userId}/projects/${job.projectId}/videos/${video.id}/thumbnail.jpg`;
        await storage.put(thumbnailKey, await readFile(thumbnail), { contentType: 'image/jpeg' });
        await db.video.update({ where: { id: video.id }, data: { thumbnailKey } });
      } catch (error) {
        // A missing poster frame should not prevent speech processing.
        console.warn('Thumbnail generation failed:', error instanceof Error ? error.message : error);
      }
    }

    const hasAudio = meta.audioCodec != null && meta.audioCodec !== 'none';
    if (!hasAudio) throw new Error('No audio track found. Upload a video with speech, or add captions manually.');

    // --- EXTRACT AUDIO ---
    await setJob(db, job.id, { status: 'extracting', progress: 15, message: 'Extracting audio' });
    const rawWavPath = path.join(ws, 'audio-raw.wav');
    await extractAudio(env, srcPath, rawWavPath, { hasAudio });
    const volume = await runFfmpeg(env, { args: ['-i', rawWavPath, '-af', 'volumedetect', '-f', 'null', '-'] });
    const peak = /max_volume:\s*(-?[\d.]+) dB/.exec(volume.stderr);
    if (peak && Number(peak[1]) < -60) throw new Error('Audio is silent or too quiet. Upload a video with audible speech.');
    await setJob(db, job.id, { status: 'extracting', progress: 22, message: 'Preparing speech audio' });
    const wavPath = env.audioPreprocessing === false ? rawWavPath : await preprocessSpeechAudio(env, rawWavPath, path.join(ws, 'audio.wav'));
    const audioKey = `users/${job.userId}/projects/${video.projectId}/videos/${video.id}/audio.wav`;
    await storage.put(audioKey, await readFile(wavPath), { contentType: 'audio/wav' });
    await db.video.update({ where: { id: video.id }, data: { status: 'extracting', audioKey } });

    // --- TRANSCRIBE ---
    await setJob(db, job.id, { status: 'transcribing', progress: 30, message: 'Transcribing audio' });
    const input = parseGenerationOptions(typeof job.input === 'string' ? JSON.parse(job.input) : job.input ?? {});
    // Restrict Hinglish recognition to Hindi/English while retaining code switches.
    const transcript = await transcribeAudio(env, transcription, wavPath, meta.duration, input.outputLanguage === 'english' ? 'en' : 'hi-latn', ws, 600, input.vocabulary);
    if (!transcript.words.length) throw new Error('No speech with word timestamps was detected. Check the audio and selected language, then retry.');
    await db.$transaction(async (tx) => {
      await tx.transcript.deleteMany({ where: { videoId: video.id } });
      const saved = await tx.transcript.create({
        data: {
          videoId: video.id,
          language: transcript.language,
          script: transcript.script,
          duration: transcript.duration,
          confidence: transcript.confidence,
          data: JSON.stringify({ sentences: transcript.sentences, silences: transcript.silences, provider: transcription.name, demo: transcription.name === 'dev', outputLanguage: input.outputLanguage, templateId: input.templateId, diagnostics: transcript.diagnostics, audioPreprocessing: env.audioPreprocessing !== false }),
        },
      });
      await tx.transcriptWord.createMany({
        data: transcript.words.map((w, i) => ({
          id: w.id,
          transcriptId: saved.id,
          index: i,
          text: w.text,
          start: w.start,
          end: w.end,
          confidence: w.confidence,
          speakerId: w.speakerId,
          isFiller: w.isFiller,
          sentenceStart: w.sentenceStart,
        })),
      });
    });
    await db.video.update({ where: { id: video.id }, data: { status: 'transcribing', error: null } });

    // --- GENERATE CAPTIONS (primary output) ---
    await setJob(db, job.id, { status: 'transcribing', progress: 70, message: 'Generating captions' });
    const captionTranscript = input.outputLanguage === 'hinglish'
      ? await convertTranscriptToHinglish(transcript, env.ollama)
      : transcript;
    if (captionTranscript.words.some(w => [...w.text].some(c => /\p{L}/u.test(c) && !/\p{Script=Latin}/u.test(c)))) {
      throw new Error('Generated captions contain a script outside the selected English/Hinglish output. Retry generation; existing captions were not replaced.');
    }
    const savedTranscript = await db.transcript.findUniqueOrThrow({ where: { videoId: video.id } });
    await db.transcript.update({ where: { videoId: video.id }, data: {
      data: JSON.stringify({ ...JSON.parse(savedTranscript.data ?? '{}'),
        conversion: { provider: input.outputLanguage === 'english' ? 'none' : env.ollama ? 'ollama' : 'rules',
          model: input.outputLanguage === 'hinglish' ? env.ollama?.model ?? null : null,
          version: 'word-mapping-v2', timingPreserved: true } }),
    } });
    const transcriptObj: Transcript = {
      language: transcript.language,
      script: input.outputLanguage === 'english' ? 'en' : captionTranscript.script,
      duration: transcript.duration,
      words: captionTranscript.words,
      sentences: captionTranscript.sentences ?? [],
      silences: transcript.silences ?? [],
      confidence: transcript.confidence,
    };
    const captionStyle = templateStyle(input.templateId, meta.height);
    const captions = buildCaptions(transcriptObj, {
      clipStart: 0,
      clipEnd: meta.duration,
      style: captionStyle,
      grouping: 'auto',
    });
    validateDocument({ captions, style: captionStyle }, meta.duration);
    if (!captions.length) throw new Error('No valid captions fit the video duration. Check provider timestamps.');
    await db.$transaction(async (tx) => {
      await tx.caption.deleteMany({ where: { videoId: video.id, clipId: null } });
      for (const caption of captions) {
        await tx.caption.create({
          data: {
            clipId: null,
            videoId: video.id,
            data: JSON.stringify({ style: captionStyle }),
            script: caption.script,
            text: caption.text,
            start: caption.start,
            end: caption.end,
            grouping: caption.grouping,
            order: caption.order,
            styleId: caption.styleId,
            words: JSON.stringify(caption.words),
          },
        });
      }

    });

    // Also store SRT for quick download
    const srtContent = captionsToSrt(captions);
    const srtKey = `users/${job.userId}/projects/${video.projectId}/videos/${video.id}/${job.id}.srt`;
    await storage.put(srtKey, Buffer.from(srtContent), { contentType: 'text/plain; charset=utf-8' });
    await db.export.create({
      data: {
        projectId: video.projectId,
        userId: job.userId,
        platform: 'srt',
        settings: JSON.stringify({ videoId: video.id, jobId: job.id, format: 'srt' }),
        status: 'ready',
        outputKey: srtKey,
        progress: 100,
        completedAt: new Date(),
      },
    });

    // --- RENDER CAPTIONED VIDEO (primary output) ---
    await setJob(db, job.id, { status: 'rendering', progress: 85, message: 'Rendering captioned video' });
    const captionedPath = path.join(ws, 'captioned.mp4');
    const burnGroups = captionsToBurnGroups(captions);
    await burnCaptions(env, srcPath, captionedPath, {
      groups: burnGroups,
      style: captionStyle,
      width: meta.width,
      height: meta.height,
      onProgress: (p) => setJob(db, job.id, { progress: 80 + p * 0.1, message: 'Rendering captioned video' }),
    });

    // Upload captioned video to storage
    const captionedKey = `users/${job.userId}/projects/${video.projectId}/videos/${video.id}/${job.id}.mp4`;
    await storage.put(captionedKey, await readFile(captionedPath), { contentType: 'video/mp4' });
    await db.video.update({ where: { id: video.id }, data: { proxyKey: captionedKey } });

    // NOTE: Clip suggestions are NOT generated here. The upload pipeline produces
    // captions + a captioned video; clips are generated on demand via a separate
    // `analyze` job (see processAnalyzeJob) so caption work can never be aborted
    // by clip analysis.

    await db.video.update({ where: { id: video.id }, data: { status: 'ready', error: null } });
    await db.project.update({ where: { id: video.projectId }, data: { status: 'ready' } });
    await setJob(db, job.id, { status: 'completed', progress: 100, message: transcription.name === 'dev' ? 'Demo captions ready - synthetic text, not a transcription' : 'Captions ready', error: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Processing failed';
    await setJob(db, job.id, { status: 'failed', error: message, message: message });
    await db.video.update({ where: { id: job.videoId }, data: { status: 'error', error: message } });
    await db.project.update({ where: { id: job.projectId }, data: { status: 'error' } });
    throw err;
  } finally {
    await rm(ws, { recursive: true, force: true });
  }
}

/** Process an `analyze` job — generate clip suggestions from an already-transcribed, captioned video. */
export async function processAnalyzeJob(
  db: Db,
  env: Env,
  storage: Storage,
  job: { id: string; projectId: string; videoId: string; userId: string },
): Promise<void> {
  try {
    const video = await db.video.findUniqueOrThrow({ where: { id: job.videoId } });
    await setJob(db, job.id, { status: 'analyzing', progress: 20, message: 'Finding best moments' });

    // Reconstruct the Transcript from the stored transcript + its word rows.
    const saved = await db.transcript.findUnique({
      where: { videoId: video.id },
      include: { words: { orderBy: { index: 'asc' } } },
    });
    if (!saved) throw new Error('No transcript to analyze. Re-run caption processing first.');
    const data = saved.data ? JSON.parse(saved.data as string) : { sentences: [], silences: [] };
    const transcript: Transcript = {
      language: saved.language as Transcript['language'],
      script: saved.script as Transcript['script'],
      duration: saved.duration,
      confidence: saved.confidence,
      words: saved.words.map((w) => ({
        id: w.id,
        text: w.text,
        start: w.start,
        end: w.end,
        confidence: w.confidence,
        speakerId: w.speakerId,
        isFiller: w.isFiller,
        sentenceStart: w.sentenceStart,
      })),
      sentences: data.sentences ?? [],
      silences: data.silences ?? [],
    };

    await setJob(db, job.id, { status: 'analyzing', progress: 50, message: 'Scoring clip moments' });
    const llm = getLLMProvider(env);
    const suggestions = await llm.analyzeTranscript(transcript, { count: 5, clipLength: 30 });

    await setJob(db, job.id, { status: 'analyzing', progress: 80, message: 'Creating clips' });
    for (let i = 0; i < suggestions.length; i++) {
      const s = suggestions[i]!;
      await db.clip.create({
        data: {
          projectId: video.projectId,
          videoId: video.id,
          title: s.title,
          duration: s.duration,
          aspect: '9:16',
          scores: JSON.stringify(s.scores),
          status: 'draft',
          order: i,
        },
      });
    }

    await db.project.update({ where: { id: video.projectId }, data: { status: 'ready' } });
    await setJob(db, job.id, { status: 'completed', progress: 100, message: 'Clips ready' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Clip analysis failed';
    await setJob(db, job.id, { status: 'failed', error: message, message });
    throw err;
  }
}

/** Process a `render` job (cut → reframe → captions → export MP4). */
export async function processRenderJob(
  db: Db,
  env: Env,
  storage: Storage,
  job: { id: string; projectId: string; videoId: string; userId: string; clipId?: string | null; input?: unknown },
): Promise<void> {
  const ws = await tmpWorkspace(job.id);
  try {
    const input = (typeof job.input === 'string' ? JSON.parse(job.input) : job.input ?? {}) as {
      exportId?: string;
      settings?: ExportSettings;
      aspect?: string;
      width?: number;
      height?: number;
    };
    const settings: ExportSettings = input.settings ?? {
      platform: 'youtube-shorts', aspect: '9:16', width: 1080, height: 1920, fps: 30,
      codec: 'h264', quality: 'medium', burnCaptions: true, audio: { volume: 1, ducking: false },
    };

    const clip = job.clipId
      ? await db.clip.findUniqueOrThrow({ where: { id: job.clipId }, include: { segments: true, captions: { orderBy: { order: 'asc' } } } })
      : null;
    const video = await db.video.findUniqueOrThrow({ where: { id: job.videoId } });
    const srcPath = await storage.resolveLocal(video.sourceKey);

    // --- CUT ---
    await setJob(db, job.id, { status: 'cutting', progress: 30, message: 'Cutting clip' });
    const cutPath = path.join(ws, 'cut.mp4');
    const segments = clip?.segments?.length
      ? clip.segments
      : [{ sourceStart: 0, sourceEnd: Math.min(settings.width ? 30 : 30, video.metadata ? JSON.parse(video.metadata as string).duration : 30) }];

    if (segments.length === 1) {
      await cutClip(env, srcPath, segments[0]!.sourceStart, segments[0]!.sourceEnd, cutPath, {
        maxHeight: 0, crf: 20,
        onProgress: (p) => setJob(db, job.id, { progress: 25 + p * 0.15, message: 'Cutting clip' }),
      });
    } else {
      // Multi-segment: cut each then concat.
      const parts: string[] = [];
      for (const seg of segments) {
        const part = path.join(ws, `part-${parts.length}.mp4`);
        await cutClip(env, srcPath, seg.sourceStart, seg.sourceEnd, part, { maxHeight: 0, crf: 20 });
        parts.push(part);
      }
      await concatVideos(env, parts, cutPath);
    }

    // --- REFRAME ---
    await setJob(db, job.id, { status: 'reframing', progress: 50, message: 'Reframing for format' });
    const reframed = path.join(ws, 'reframed.mp4');
    if (clip?.aspect && clip.aspect !== '16:9') {
      await reframeVideo(env, cutPath, reframed, {
        aspect: clip.aspect as ExportSettings['aspect'],
        outputHeight: settings.height,
        onProgress: (p) => setJob(db, job.id, { progress: 48 + p * 0.1, message: 'Reframing video' }),
      });
    } else {
      await reframeVideo(env, cutPath, reframed, { aspect: settings.aspect, outputHeight: settings.height });
    }

    // --- CAPTIONS ---
    let captioned = reframed;
    if (settings.burnCaptions) {
      await setJob(db, job.id, { status: 'rendering', progress: 65, message: 'Rendering captions' });
      let groups = clip?.captions?.length
        ? captionsToBurnGroups(clip.captions.map((c) => ({ ...c, clipId: c.clipId ?? '', script: c.script as import('@clipx/types').Caption['script'], grouping: c.grouping as import('@clipx/types').Caption['grouping'], words: JSON.parse(c.words) })))
        : [];
      if (groups.length === 0) {
        // Auto-generate captions from the clip's transcript words.
        const transcript = await db.transcript.findUnique({
          where: { videoId: video.id },
          include: { words: { orderBy: { index: 'asc' } } },
        });
        if (transcript?.words?.length) {
          const start = clip?.segments?.[0]?.sourceStart ?? 0;
          const end = clip?.segments?.[clip.segments.length - 1]?.sourceEnd ?? start + 30;
          const built = buildCaptions(
            {
              language: transcript.language as any,
              script: transcript.script as any,
              duration: transcript.duration,
              words: transcript.words.map((w) => ({
                id: w.id, text: w.text, start: Math.max(0, w.start - start), end: Math.max(0, w.end - start),
                confidence: w.confidence, isFiller: w.isFiller,
              })),
              sentences: [], silences: [], confidence: transcript.confidence,
            },
            { clipStart: 0, clipEnd: end - start, style: DEFAULT_CAPTION_STYLE, grouping: 'auto' },
          );
          groups = captionsToBurnGroups(built);
        }
      }
      const captionedPath = path.join(ws, 'captioned.mp4');
      await burnCaptions(env, reframed, captionedPath, {
        groups,
        style: DEFAULT_CAPTION_STYLE,
        width: settings.width,
        height: settings.height,
        onProgress: (p) => setJob(db, job.id, { progress: 62 + p * 0.2, message: 'Rendering captions' }),
      });
      captioned = captionedPath;
    }

    // --- FINAL RENDER ---
    await setJob(db, job.id, { status: 'rendering', progress: 85, message: 'Encoding final video' });
    const finalPath = path.join(ws, 'final.mp4');
    await renderExport(env, captioned, finalPath, {
      settings,
      onProgress: (p) => setJob(db, job.id, { progress: 82 + p * 0.13, message: 'Encoding final video' }),
    });

    // --- UPLOAD OUTPUT ---
    await setJob(db, job.id, { status: 'uploading', progress: 97, message: 'Uploading result' });
    const ext = settings.codec === 'h265' ? 'hevc' : 'mp4';
    const outputKey = `users/${job.userId}/projects/${video.projectId}/clips/${job.clipId ?? 'render'}-${job.id}.${ext}`;
    await storage.put(outputKey, await readFile(finalPath), { contentType: 'video/mp4' });
    if (clip) await db.clip.update({ where: { id: clip.id }, data: { status: 'ready', proxyKey: outputKey } });
    if (input.exportId) await db.export.updateMany({ where: { id: input.exportId, userId: job.userId, projectId: job.projectId }, data: { status: 'ready', outputKey, progress: 100, completedAt: new Date() } });
    await setJob(db, job.id, { status: 'completed', progress: 100, message: 'Export ready', outputKey });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Render failed';
    await setJob(db, job.id, { status: 'failed', error: message, message });
    if (job.clipId) await db.clip.update({ where: { id: job.clipId }, data: { status: 'error' } });
    const input = (typeof job.input === 'string' ? JSON.parse(job.input) : job.input ?? {}) as { exportId?: string };
    if (input.exportId) await db.export.updateMany({ where: { id: input.exportId, userId: job.userId, projectId: job.projectId }, data: { status: 'failed', error: message } });
    throw err;
  } finally {
    await rm(ws, { recursive: true, force: true });
  }
}

/** Concatenate MP4 segments (same codec/resolution) into one file. */
async function concatVideos(env: Env, parts: string[], out: string): Promise<void> {
  const { runFfmpeg } = await import('@clipx/video-engine');
  const { writeFile } = await import('node:fs/promises');
  const listFile = out + '.txt';
  await writeFile(listFile, parts.map((p) => `file '${p.replace(/\\/g, '/')}'`).join('\n'));
  await runFfmpeg(env, {
    args: ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', out],
  });
}
