/**
 * WhisperProvider — OpenAI-compatible `/audio/transcriptions` endpoint.
 * Activated automatically when `TRANSCRIPTION_API_KEY` is configured.
 * Returns word-level timestamps via `verbose_json`.
 */

import { readFile, stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import type { LanguageCode, Transcript } from '@clipx/types';
import { TranscriptionProvider, TranscribeOptions, detectFiller, guessLanguage } from './transcription';

export interface WhisperConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

interface VerboseJsonSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  words?: Array<{ word: string; start: number; end: number; probability: number }>;
}

export class WhisperProvider implements TranscriptionProvider {
  readonly name = 'whisper';

  constructor(private readonly config: WhisperConfig) {}

  async transcribe(audioPath: string, opts: TranscribeOptions = {}): Promise<Transcript> {
    if ((await stat(audioPath)).size > 24_000_000) throw new Error('Audio exceeds the transcription upload limit. Split the audio into smaller sections before transcription.');
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(await readFile(audioPath))], { type: 'audio/wav' }), 'audio.wav');
    form.append('model', this.config.model);
    if (opts.vocabulary?.length) form.append('prompt', opts.vocabulary.join(', '));
    form.append('response_format', 'verbose_json');
    if (opts.language && opts.language !== 'auto') form.append('language', opts.language);
    form.append('timestamp_granularities[]', 'word');

    const res = await fetch(`${this.config.baseUrl.replace(/\/$/, '')}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.config.apiKey}` },
      body: form,
      signal: AbortSignal.timeout(120_000),
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) throw new Error('Transcription access was denied. Check TRANSCRIPTION_API_KEY and model access, then restart the worker.');
      if (res.status === 429) throw new Error('Transcription quota or rate limit reached. Check the API account billing/usage limits, then retry.');
      if (res.status === 413) throw new Error('The transcription provider rejected the audio size. Use a shorter audio section.');
      throw new Error(`Speech transcription failed (HTTP ${res.status}). Check the provider endpoint/model settings and retry. No sample captions were substituted.`);
    }

    const data = (await res.json()) as {
      language?: string;
      duration?: number;
      words?: Array<{ word: string; start: number; end: number; probability?: number }>;
      segments?: VerboseJsonSegment[];
    };

    const words = (data.words ?? (data.segments ?? []).flatMap((seg) => seg.words ?? [])).map((w) => ({
        id: randomUUID(),
        text: w.word.trim(),
        start: w.start,
        end: w.end,
        confidence: w.probability ?? 0,
        isFiller: detectFiller(w.word),
      }));
    if (words.some((w) => !w.text || !Number.isFinite(w.start) || !Number.isFinite(w.end) || w.start < 0 || w.end <= w.start)) {
      throw new Error('Provider returned invalid word timestamps. Try another transcription model.');
    }

    const sentences = groupWordsToSentences(words, data.segments ?? []);

    return {
      language: ({ english: 'en', hindi: 'hi' }[data.language ?? ''] ?? data.language ?? guessLanguage(words.map((w) => w.text))) as LanguageCode,
      script: words.some((w) => /[\u0900-\u097f]/.test(w.text)) ? 'mixed' : 'en',
      duration: data.duration ?? opts.audioDuration ?? (words.at(-1)?.end ?? 0),
      words,
      sentences,
      silences: detectSilences(words),
      confidence: words.length
        ? words.reduce((a, w) => a + w.confidence, 0) / words.length
        : 0,
    };
  }
}

function groupWordsToSentences(
  words: Transcript['words'],
  segments: VerboseJsonSegment[],
): Transcript['sentences'] {
  const byStart = new Map<number, VerboseJsonSegment>();
  for (const seg of segments) byStart.set(Math.round(seg.start * 100), seg);

  const out: Transcript['sentences'] = [];
  let buf: Transcript['words'] = [];
  for (const w of words) {
    const seg = byStart.get(Math.round(w.start * 100));
    buf.push(w);
    if (seg && Math.abs((seg.end) - w.end) < 0.5) {
      out.push({
        id: randomUUID(),
        text: buf.map((b) => b.text).join(' '),
        start: buf[0]!.start,
        end: buf[buf.length - 1]!.end,
        wordIds: buf.map((b) => b.id),
        confidence: buf.reduce((a, b) => a + b.confidence, 0) / buf.length,
      });
      buf = [];
    }
  }
  if (buf.length) {
    out.push({
      id: randomUUID(),
      text: buf.map((b) => b.text).join(' '),
      start: buf[0]!.start,
      end: buf[buf.length - 1]!.end,
      wordIds: buf.map((b) => b.id),
      confidence: buf.reduce((a, b) => a + b.confidence, 0) / buf.length,
    });
  }
  return out;
}

function detectSilences(words: Transcript['words'], gapMs = 600): Transcript['silences'] {
  const silences: Transcript['silences'] = [];
  for (let i = 1; i < words.length; i++) {
    const gap = words[i]!.start - words[i - 1]!.end;
    if (gap > gapMs / 1000) {
      silences.push({ start: words[i - 1]!.end, end: words[i]!.start, duration: gap });
    }
  }
  return silences;
}

/** Exporting for reuse by dev provider. */
export { groupWordsToSentences, detectSilences };
