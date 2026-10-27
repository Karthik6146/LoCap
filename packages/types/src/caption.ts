/**
 * Caption engine domain types — the headline feature.
 * Captions are word-level so each word can be styled/animated independently.
 */

import type { CaptionScript } from './transcript';

export type CaptionAnimation =
  | 'none' | 'pop' | 'bounce' | 'fade' | 'slide' | 'typewriter' | 'scale'
  | 'word-by-word' | 'character-by-character' | 'karaoke' | 'shake'
  | 'elastic' | 'blur-in' | 'blur-out' | 'zoom' | 'rotate' | 'wave';

/** A caption word bound to a transcript word, with override styling. */
export interface CaptionWord {
  id: string;
  /** TranscriptWord.id it maps to (keeps timing stable when text changes). */
  transcriptWordId: string;
  text: string;
  start: number;
  end: number;
  /** Optional per-word style overrides (null = inherit from Caption). */
  highlight?: boolean;
  color?: string | null;
  scale?: number | null;
  animation?: CaptionAnimation | null;
  bold?: boolean | null;
}

/** A caption is a visually grouped chunk of words (a line/fragment). */
export interface Caption {
  id: string;
  clipId: string;
  /** CaptionScript the text is rendered in. */
  script: CaptionScript;
  text: string;
  start: number;
  end: number;
  words: CaptionWord[];
  /** How words were grouped into this caption. */
  grouping: 'sentence' | 'word' | 'auto' | 'custom';
  /** Index within the timeline. */
  order: number;
  styleId: string;
}

/** Animated word-highlight config for karaoke-style captions. */
export interface WordHighlight {
  enabled: boolean;
  activeColor: string;
  /** Scale multiplier of the active word, e.g. 1.25. */
  activeScale: number;
  activeBold: boolean;
}

export interface CaptionStyle {
  /** Optional v2 settings; old saved styles remain valid. */
  devanagariFont?: string;
  positionX?: number;
  positionY?: number;
  animationStrength?: number;
  wordEffect?: 'plain' | 'marker' | 'neon';
  opacity?: number;
  alignment?: 'left' | 'center' | 'right';
  id: string;
  name: string;
  category:
    | 'minimal' | 'bold' | 'gaming' | 'podcast' | 'karaoke' | 'news'
    | 'educational' | 'comedy' | 'luxury' | 'neon' | 'meme' | 'professional';
  font: string;
  fontWeight: number;
  fontSize: number;          // relative units
  color: string;
  highlightColor: string;
  /** Stroke / outline. */
  stroke: { width: number; color: string };
  /** Drop shadow. */
  shadow: { blur: number; color: string; offsetX: number; offsetY: number };
  background: { enabled: boolean; color: string; opacity: number; radius: number };
  animation: CaptionAnimation;
  position: 'top' | 'center' | 'bottom' | 'custom';
  yOffset: number;
  wordSpacing: number;
  lineSpacing: number;
  /** Max words per caption line (grouping). */
  maxWordsPerGroup: number;
  highlight: WordHighlight;
  /** Prebuilt: not user-editable at runtime. */
  builtin?: boolean;
}

export type CaptionEditScope = 'word' | 'sentence' | 'clip' | 'all';

/** A word as handed to the FFmpeg burn renderer. */
export interface BurnWord {
  text: string;
  start: number;
  end: number;
  highlight?: boolean;
}

/** A caption group handed to the FFmpeg burn renderer. */
export interface BurnGroup {
  start: number;
  end: number;
  words: BurnWord[];
}
