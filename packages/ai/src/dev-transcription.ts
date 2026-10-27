/**
 * DevTranscriptionProvider — a LOCAL DEVELOPMENT STAND-IN only.
 *
 * ⚠️ It does NOT listen to the audio. It lays a bundled, representative
 * Hinglish/English demo script across the audio's duration with deterministic
 * word timings so the full pipeline (probe → transcribe → analyze → cut →
 * captions) can be exercised end-to-end with no API key. Production traffic
 * uses WhisperProvider, selected automatically when TRANSCRIPTION_API_KEY is set.
 */

import { randomUUID } from 'node:crypto';
import type { CaptionScript, LanguageCode, Transcript, TranscriptWord } from '@clipx/types';
import { TranscriptionProvider, TranscribeOptions, detectFiller } from './transcription';
import { detectSilences } from './whisper';

const DEMO_SCRIPT =
  "Guys aaj hum ek insane Valorant match dekhne wale hain. Bro REALLY thought he could win this clutch. Uh the whole team was screaming. Honestly this is the craziest moment I have ever seen. Let's gooo! One million views incoming, mark my words.";

export class DevTranscriptionProvider implements TranscriptionProvider {
  readonly name = 'dev';

  constructor(
    private readonly opts: {
      /** Override the demo text (still laid out deterministically). */
      text?: string;
      /** Override word-per-second pacing. */
      wps?: number;
    } = {},
  ) {}

  async transcribe(audioPath: string, opts: TranscribeOptions = {}): Promise<Transcript> {
    const words = tokenize(this.opts.text ?? DEMO_SCRIPT);
    const duration = Math.max(opts.audioDuration ?? 10, 2);
    const wps = this.opts.wps ?? Math.max(1.5, words.length / duration);

    let t = 0;
    const transcriptWords: TranscriptWord[] = [];
    for (const text of words) {
      const dur = 1 / wps;
      transcriptWords.push({
        id: randomUUID(),
        text,
        start: round(t),
        end: round(t + dur),
        confidence: 0, // Synthetic fixture: not a measured recognition confidence.
        isFiller: detectFiller(text),
      });
      t += dur;
    }

    // Sentence boundaries on punctuation.
    const sentences = buildSentences(transcriptWords, this.opts.text ?? DEMO_SCRIPT);

    const language: LanguageCode = 'en';
    const script: CaptionScript = opts.script ?? 'hi-latn';

    return {
      language,
      script,
      duration,
      words: transcriptWords,
      sentences,
      silences: detectSilences(transcriptWords, 400),
      confidence: 0.94,
    };
  }
}

function tokenize(text: string): string[] {
  return text.split(/\s+/).map((w) => w.replace(/[.,!?;:]+$/, '')).filter(Boolean);
}

function buildSentences(words: TranscriptWord[], sourceText: string): Transcript['sentences'] {
  const sentenceTexts = sourceText
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out: Transcript['sentences'] = [];
  let wi = 0;
  for (const st of sentenceTexts) {
    const count = tokenize(st).length;
    const slice = words.slice(wi, wi + count);
    if (slice.length === 0) continue;
    out.push({
      id: randomUUID(),
      text: st,
      start: slice[0]!.start,
      end: slice[slice.length - 1]!.end,
      wordIds: slice.map((w) => w.id),
      confidence: slice.reduce((a, w) => a + w.confidence, 0) / slice.length,
    });
    wi += count;
  }
  return out;
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
