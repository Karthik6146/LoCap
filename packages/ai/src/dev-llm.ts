/**
 * DevLLMProvider — deterministic, rule-based heuristic scoring so clip
 * detection and content generation work with no API key. Real heuristics
 * (hook/emotion/payoff scoring), not fake progress.
 */

import { randomUUID } from 'node:crypto';
import type { ClipSuggestion, GeneratedPostContent, Transcript } from '@clipx/types';
import { AnalyzeOptions, LLMProvider, RewriteMode } from './llm';
import { EMOJI_MAP, EMOTION_WORDS, suggestEmojis } from './emoji';

const PUNCT = /[.!?]/;

export class DevLLMProvider implements LLMProvider {
  readonly name = 'dev';

  async analyzeTranscript(t: Transcript, opts: AnalyzeOptions): Promise<ClipSuggestion[]> {
    const sentences = t.sentences;
    if (sentences.length === 0) return [];

    // Build sliding windows of consecutive sentences approximating clipLength.
    const windows = buildWindows(sentences, opts.clipLength, t.duration);

    const scored = windows.map((win) => scoreWindow(win, t, opts));
    scored.sort((a, b) => b.scores.overall - a.scores.overall);
    return scored.slice(0, opts.count);
  }

  async generateHooks(text: string, count: number): Promise<string[]> {
    const base = text.split(PUNCT)[0]?.trim() || text.slice(0, 60);
    const hooks = [
      `This changed everything... ${base}`,
      `Nobody talks about this but... ${base}`,
      `Wait until you see what happens next...`,
      `I can't believe this actually happened.`,
      `You won't believe what just went down.`,
      `Watch this to the very end.`,
      `This is the craziest thing I've seen all week.`,
      `Buckle up, because this gets insane.`,
      `The internet isn't ready for this.`,
      `One clip. One insane moment.`,
    ];
    return hooks.slice(0, count);
  }

  async generatePostContent(text: string): Promise<GeneratedPostContent> {
    const firstSentence = text.split(PUNCT)[0]?.trim() || text.slice(0, 60);
    const titles = [
      `THE CRAZIEST ${firstSentence.toUpperCase().slice(0, 40)} 😭`,
      `Wait for it... ${firstSentence.slice(0, 40)}`,
      `${firstSentence.slice(0, 40)} — you HAVE to see this`,
    ];
    return {
      titles,
      instagramCaption: `${text}\n\n🔥 Drop a follow for more!`,
      youtubeDescription: `${text}\n\n#shorts #viral #gaming`,
      tiktokCaption: `POV: ${text} #fyp #viral`,
      hashtags: ['#shorts', '#viral', '#gaming', '#fyp', '#clip'],
      keywords: firstSentence.split(' ').slice(0, 5),
    };
  }

  async suggestEmojis(text: string, max = 3): Promise<string[]> {
    return suggestEmojis(text, max);
  }

  async rewrite(text: string, mode: RewriteMode): Promise<string> {
    switch (mode) {
      case 'shorten':
        return text.length > 80 ? `${text.slice(0, 77).trimEnd()}...` : text;
      case 'funny':
        return `${text} 😂 (that was crazy)`;
      case 'professional':
        return text.replace(/\bguys\b/gi, 'everyone');
      case 'genz':
        return `${text} fr fr no cap`;
      case 'hinglish':
        return hinglishify(text);
      case 'grammar':
        return text;
      case 'engaging':
        return `${text} — and you won't believe what happens next 👀`;
      case 'translate':
      default:
        return text;
    }
  }

  async translate(text: string, to: string): Promise<string> {
    // Dev provider: only supports a small Hinglish mapping; real providers do more.
    if (to === 'hi-latn' || to === 'hinglish') return hinglishify(text);
    return text;
  }
}

function buildWindows(
  sentences: Transcript['sentences'],
  clipLength: number,
  totalDuration: number,
): Transcript['sentences'][] {
  const windows: Transcript['sentences'][] = [];
  for (let i = 0; i < sentences.length; i++) {
    const win: Transcript['sentences'] = [];
    let span = 0;
    for (let j = i; j < sentences.length; j++) {
      const s = sentences[j]!;
      if (span + (s.end - s.start) > clipLength * 1.5 && win.length > 0) break;
      win.push(s);
      span += s.end - s.start;
      if (span >= clipLength * 0.7) break;
    }
    if (win.length) windows.push(win);
  }
  return windows;
}

function scoreWindow(
  win: Transcript['sentences'],
  t: Transcript,
  opts: AnalyzeOptions,
): ClipSuggestion {
  const text = win.map((s) => s.text).join(' ');
  const words = text.split(' ');

  let hook = 40;
  const first = win[0]?.text.toLowerCase() ?? '';
  if (/^(wait|watch|you won't|nobody|this|bro|guys|okay so|so)/.test(first)) hook += 25;
  if (first.includes('?')) hook += 20;

  let emotion = 40;
  for (const w of words) {
    if (EMOTION_WORDS.has(w.toLowerCase())) { emotion += 15; break; }
  }
  if (/!+/.test(text)) emotion += 20;
  if (/crazy|insane|unbelievable|best|worst/i.test(text)) emotion += 15;

  let payoff = 45;
  if (win.length >= 3 && /!|so|then|and/.test(win[win.length - 1]!.text)) payoff += 20;
  if (win.length >= 4) payoff += 10;

  let clarity = 55 + Math.min(25, win.length * 5);
  if (text.length > 320) clarity -= 10;

  let shareability = 40;
  if (emotion > 55) shareability += 20;
  if (/one million|lets go|letsgo|record|views/i.test(text)) shareability += 20;

  const overall = Math.round(
    0.25 * hook + 0.25 * emotion + 0.2 * payoff + 0.15 * clarity + 0.15 * shareability,
  );

  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

  const start = win[0]!.start;
  const end = win[win.length - 1]!.end;
  const title = makeTitle(text);

  return {
    id: randomUUID(),
    start,
    end,
    duration: Math.round((end - start) * 100) / 100,
    title,
    reason: `${hook >= 60 ? 'Strong hook' : 'Clear segment'} + ${
      emotion >= 55 ? 'high emotion' : 'solid context'
    } + ${payoff >= 55 ? 'satisfying payoff' : 'clean ending'}`,
    scores: {
      overall: clamp(overall),
      hook: clamp(hook),
      payoff: clamp(payoff),
      emotion: clamp(emotion),
      clarity: clamp(clarity),
      shareability: clamp(shareability),
    },
    topics: extractTopics(text),
    emotionTags: emotion >= 55 ? ['intense'] : emotion >= 45 ? ['engaging'] : [],
    source: 'ai',
  };
}

function makeTitle(text: string): string {
  const s = text.slice(0, 90).trim();
  return s.length > 80 ? `${s.slice(0, 77)}...` : s;
}

function extractTopics(text: string): string[] {
  const words = text.toLowerCase().split(/\W+/).filter((w) => w.length > 4);
  const seen = new Set<string>();
  const topics: string[] = [];
  for (const w of words) {
    if (!seen.has(w)) { seen.add(w); topics.push(w); }
    if (topics.length >= 5) break;
  }
  return topics;
}

function hinglishify(text: string): string {
  const map: Record<string, string> = {
    let: 'chalo', go: 'chalo', see: 'dekho', watch: 'dekho', is: 'hai',
    was: 'tha', are: 'ho', what: 'kya', why: 'kyun', how: 'kaise',
    will: 'karenge', look: 'dekh', crazy: 'pagna', insane: 'pagna',
    you: 'tum', your: 'tumhara', this: 'yeh', that: 'woh', do: 'karo',
  };
  return text
    .split(/(\s+)/)
    .map((w) => (map[w.toLowerCase()] ? map[w.toLowerCase()] : w))
    .join('');
}

export { EMOJI_MAP };
