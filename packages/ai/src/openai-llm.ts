/**
 * OpenAIPromptLLMProvider — real LLM provider using the OpenAI-compatible chat
 * completions API. Activated when AI_API_KEY is set. Defensive: falls back to
 * sensible defaults if the model returns malformed JSON.
 */

import type { ClipSuggestion, GeneratedPostContent, Transcript } from '@clipx/types';
import { AnalyzeOptions, LLMProvider, RewriteMode } from './llm';
import { suggestEmojis } from './emoji';

export interface OpenAIConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

interface ChatMessage { role: 'system' | 'user'; content: string }

export class OpenAIPromptLLMProvider implements LLMProvider {
  readonly name = 'openai';

  constructor(private readonly config: OpenAIConfig) {}

  private async complete(system: string, user: string, json = false): Promise<string> {
    const messages: ChatMessage[] = [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ];
    const res = await fetch(`${this.config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        temperature: 0.7,
        response_format: json ? { type: 'json_object' } : undefined,
      }),
    });
    if (!res.ok) {
      throw new Error(`LLM request failed (${res.status})`);
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content ?? '';
  }

  async analyzeTranscript(t: Transcript, opts: AnalyzeOptions): Promise<ClipSuggestion[]> {
    const text = t.sentences.map((s) => `${s.start.toFixed(2)}-${s.end.toFixed(2)}: ${s.text}`).join('\n');
    const system =
      'You are an expert video clip finder. Return JSON: {"clips":[{"start":number,"end":number,"title":string,"reason":string,"scores":{"overall":0,"hook":0,"payoff":0,"emotion":0,"clarity":0,"shareability":0}}]}.';
    const user = `Transcript (start-end: text):\n${text}\n\nFind the top ${opts.count} clips of about ${opts.clipLength}s${
      opts.instruction ? `. User instruction: ${opts.instruction}` : ''
    }.`;
    try {
      const raw = await this.complete(system, user, true);
      const parsed = JSON.parse(raw) as { clips?: ClipSuggestion[] };
      return (parsed.clips ?? []).map((c) => ({ ...c, source: 'ai' as const, duration: c.end - c.start, topics: [], emotionTags: [] }));
    } catch {
      return [];
    }
  }

  async generateHooks(text: string, count: number): Promise<string[]> {
    try {
      const raw = await this.complete(
        'Return JSON: {"hooks":["..."]}.',
        `Generate ${count} short attention-grabbing hooks for: "${text.slice(0, 500)}"`,
        true,
      );
      const parsed = JSON.parse(raw) as { hooks?: string[] };
      return parsed.hooks ?? [];
    } catch {
      return [];
    }
  }

  async generatePostContent(text: string): Promise<GeneratedPostContent> {
    try {
      const raw = await this.complete(
        'Return JSON: {"titles":[],"instagramCaption":"","youtubeDescription":"","tiktokCaption":"","hashtags":[],"keywords":[]}.',
        `Create 5 titles, captions, hashtags and keywords for: "${text.slice(0, 500)}"`,
        true,
      );
      return JSON.parse(raw) as GeneratedPostContent;
    } catch {
      return {
        titles: [], instagramCaption: '', youtubeDescription: '',
        tiktokCaption: '', hashtags: [], keywords: [],
      };
    }
  }

  async suggestEmojis(text: string, max = 3): Promise<string[]> {
    // Rule-based map is deterministic and good enough; LLM optional refinement.
    return suggestEmojis(text, max);
  }

  async rewrite(text: string, mode: RewriteMode): Promise<string> {
    try {
      return await this.complete(
        `Rewrite the caption. Mode: ${mode}. Return only the rewritten text.`,
        text,
      );
    } catch {
      return text;
    }
  }

  async translate(text: string, to: string): Promise<string> {
    try {
      return await this.complete(
        `Translate the caption to ${to}. Preserve meaning and tone. Return only the translation.`,
        text,
      );
    } catch {
      return text;
    }
  }
}
