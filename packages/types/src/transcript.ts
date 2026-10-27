/**
 * Shared domain types for the AI transcription pipeline.
 * Word- and sentence-level timestamps power the caption engine.
 */

export type LanguageCode =
  | 'en' | 'hi' | 'hi-latn' | 'bn' | 'gu' | 'kn' | 'ml' | 'mr'
  | 'or' | 'pa' | 'ta' | 'te' | 'es' | 'fr' | 'de' | 'ja' | 'ko' | 'ar';

/** A single spoken word with precise timing. */
export interface TranscriptWord {
  id: string;
  text: string;
  /** Start time in seconds. */
  start: number;
  /** End time in seconds. */
  end: number;
  /** 0..1 speaker-independent confidence. */
  confidence: number;
  /** Optional speaker id if diarization is available. */
  speakerId?: string | null;
  /** True when this word is a detected filler (uh, um, like, you know…). */
  isFiller?: boolean;
  /** Whether the word starts a new sentence. */
  sentenceStart?: boolean;
}

/** A sentence grouping of words, with sentence-level timing. */
export interface TranscriptSentence {
  id: string;
  text: string;
  start: number;
  end: number;
  wordIds: string[];
  confidence: number;
  speakerId?: string | null;
}

/** A detected silent gap. */
export interface SilenceGap {
  start: number;
  end: number;
  duration: number;
}

/**
 * The full transcription result for one audio/video.
 * `script` describes the caption script the user is viewing (Roman Hinglish,
 * native Hindi, English, mixed) — switching it never changes meaning/timing.
 */
export interface Transcript {
  diagnostics?: {
    model: string; computeType: string; alignment: string;
    alignedWords: number; fallbackWords: number; chunkCount: number;
    speechSeconds: number; warnings: string[];
    vocabulary?: string[];
    corrections?: { source: string; replacement: string; start: number; end: number }[];
  };
  language: LanguageCode;
  /** Detected script the words are currently rendered in. */
  script: CaptionScript;
  duration: number;
  words: TranscriptWord[];
  sentences: TranscriptSentence[];
  silences: SilenceGap[];
  /** 0..1 overall confidence. */
  confidence: number;
}

/** The script/locale used to *display* captions, independent of meaning. */
export type CaptionScript =
  | 'en'        // English
  | 'hi'        // native Hindi (Devanagari)
  | 'hi-latn'   // Roman Hinglish
  | 'mixed';    // English/Hindi mixed, as spoken

/** Caption script display preferences (section 8 of spec). */
export interface ScriptPreference {
  sourceLanguage: LanguageCode;
  /** How spoken Hinglish should be rendered by default. */
  defaultScript: CaptionScript;
  /** Native-script Hindi only when the user explicitly chooses it. */
  allowNativeScript: boolean;
}
