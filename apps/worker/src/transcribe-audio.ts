import path from 'node:path';
import type { Env, Transcript } from '@clipx/types';
import type { TranscriptionProvider } from '@clipx/ai';
import { runFfmpeg } from '@clipx/video-engine';

/** 10-minute 16kHz mono PCM chunks stay below the provider's upload limit. */
export async function transcribeAudio(env: Env, provider: TranscriptionProvider, audio: string, duration: number, language: string, workspace: string, chunkSeconds = 600, vocabulary?: string[]): Promise<Transcript> {
  if (!Number.isFinite(duration) || duration <= 0 || chunkSeconds <= 0) throw new Error('Invalid audio duration.');
  // Remote Whisper accepts ISO source languages, not the local bilingual policy.
  if (language === 'hi-latn' && provider.name !== 'local-whisper') language = 'hi';
  // Local provider owns Silero speech boundaries and original timeline offsets.
  const hints = vocabulary?.length ? { vocabulary } : {};
  if (provider.name === 'local-whisper' || duration <= chunkSeconds) return provider.transcribe(audio, { audioDuration: duration, language, ...hints });
  let result: Transcript | undefined;
  for (let offset = 0; offset < duration; offset += chunkSeconds) {
    const length = Math.min(chunkSeconds, duration - offset);
    const file = path.join(workspace, `speech-${offset}.wav`);
    await runFfmpeg(env, { args: ['-y', '-ss', String(offset), '-i', audio, '-t', String(length), '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', file] });
    const part = await provider.transcribe(file, { audioDuration: length, language, ...hints });
    result ??= { ...part, duration, words: [], sentences: [], silences: [], confidence: 0 };
    result.words.push(...part.words.map(w => ({ ...w, start: w.start + offset, end: w.end + offset })));
    result.sentences.push(...part.sentences.map(s => ({ ...s, start: s.start + offset, end: s.end + offset })));
    result.silences.push(...part.silences.map(s => ({ ...s, start: s.start + offset, end: s.end + offset })));
    if (part.script !== result.script) result.script = 'mixed';
  }
  if (!result) throw new Error('No audio to transcribe.');
  result.confidence = result.words.length ? result.words.reduce((sum, w) => sum + w.confidence, 0) / result.words.length : 0;
  return result;
}
