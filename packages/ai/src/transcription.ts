/**
 * TranscriptionProvider abstraction (spec section 43).
 * Concrete implementations: WhisperProvider (real), DevTranscriptionProvider
 * (local dev stand-in, clearly labeled). Swap by configuration — never hard-coded.
 */

import type { CaptionScript, LanguageCode, Transcript } from '@clipx/types';

export interface TranscribeOptions {
  /** Names and short phrases that occur in the audio. */
  vocabulary?: string[];
  /** Optional language hint (ISO code or "auto"). */
  language?: string;
  /** Duration of the source audio in seconds (used for layout by dev provider). */
  audioDuration?: number;
  /** Preferred caption script for Hinglish-aware output. */
  script?: CaptionScript;
}

export interface TranscriptionProvider {
  /** Stable provider name, e.g. "whisper", "dev". */
  readonly name: string;
  transcribe(audioPath: string, opts?: TranscribeOptions): Promise<Transcript>;
}

/** Common transcript normalization helpers. */

export function detectFiller(word: string): boolean {
  const w = word.replace(/[^a-z]/gi, '').toLowerCase();
  const fillers = new Set(['uh', 'um', 'ah', 'er', 'hmm', 'like', 'you', 'basically', 'actually', 'literally', 'so', 'okay']);
  return fillers.has(w);
}

export function guessLanguage(words: string[]): LanguageCode {
  const latin = words.filter((w) => /^[a-z0-9'-]+$/i.test(w)).length;
  const devanagari = words.filter((w) => /[ऀ-ॿ]/.test(w)).length;
  if (devanagari > latin) return 'hi';
  if (devanagari > 0) return 'hi-latn' as LanguageCode;
  return 'en';
}
