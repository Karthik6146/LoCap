/**
 * LLMProvider abstraction (spec section 43). Powers clip detection, hooks,
 * titles, captions, emoji and rewrite. DevLLMProvider is a real rule-based
 * heuristic implementation; an OpenAI-compatible provider can be dropped in.
 */

import type {
  ClipSuggestion,
  GeneratedPostContent,
  Transcript,
} from '@clipx/types';

export interface AnalyzeOptions {
  count: number;
  clipLength: number;
  instruction?: string;
  minClipLength?: number;
}

export type RewriteMode =
  | 'shorten' | 'funny' | 'professional' | 'genz' | 'hinglish'
  | 'translate' | 'grammar' | 'engaging';

export interface LLMProvider {
  readonly name: string;
  analyzeTranscript(t: Transcript, opts: AnalyzeOptions): Promise<ClipSuggestion[]>;
  generateHooks(text: string, count: number): Promise<string[]>;
  generatePostContent(text: string, opts?: { count?: number }): Promise<GeneratedPostContent>;
  suggestEmojis(text: string, max?: number): Promise<string[]>;
  rewrite(text: string, mode: RewriteMode): Promise<string>;
  translate(text: string, to: string): Promise<string>;
}
