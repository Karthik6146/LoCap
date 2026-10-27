/**
 * AI provider factory — selects concrete providers from environment config so
 * the application is never hard-wired to a single vendor (spec section 43).
 */

import type { Env } from '@clipx/types';
import { TranscriptionProvider } from './transcription';
import { WhisperProvider } from './whisper';
import { DevTranscriptionProvider } from './dev-transcription';
import { LocalTranscriptionProvider } from './local-transcription';
import { LLMProvider } from './llm';
import { OpenAIPromptLLMProvider } from './openai-llm';
import { DevLLMProvider } from './dev-llm';
export type { TranscriptionProvider, TranscribeOptions } from './transcription';
export type { LLMProvider, AnalyzeOptions, RewriteMode } from './llm';
export { WhisperProvider } from './whisper';
export { DevTranscriptionProvider } from './dev-transcription';
export { DevLLMProvider } from './dev-llm';
export { OpenAIPromptLLMProvider } from './openai-llm';
export { suggestEmojis, EMOJI_MAP } from './emoji';
export { convertWordScript, convertLineScript } from './script';
export { convertTranscriptToHinglish } from './ollama-hinglish';

export function getTranscriptionProvider(env: Env): TranscriptionProvider {
  if (env.localTranscription) return new LocalTranscriptionProvider(env.localTranscription);
  if (env.transcription?.apiKey) {
    return new WhisperProvider({
      apiKey: env.transcription.apiKey,
      baseUrl: env.transcription.baseUrl,
      model: env.transcription.model,
    });
  }
  // Synthetic output is a test fixture only, never a fallback for user uploads.
  if (env.nodeEnv === 'test') return new DevTranscriptionProvider();
  throw new Error('Speech transcription is not configured. Set up local Whisper with TRANSCRIPTION_PROVIDER=local, or add TRANSCRIPTION_API_KEY in the root .env. Restart the worker and generate captions again. No sample captions were generated.');
}

export function getLLMProvider(env: Env): LLMProvider {
  if (env.llm?.apiKey) {
    return new OpenAIPromptLLMProvider({
      apiKey: env.llm.apiKey,
      baseUrl: env.llm.baseUrl,
      model: env.llm.model,
    });
  }
  return new DevLLMProvider();
}
export * from './hinglish';
