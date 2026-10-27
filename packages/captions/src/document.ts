import type { Caption, CaptionStyle } from '@clipx/types';
import { DEFAULT_CAPTION_STYLE } from './styles';
import { CAPTION_FONTS, DEVANAGARI_FONTS } from './fonts';

export interface CaptionDocument { captions: Caption[]; style: CaptionStyle }

/** Restrict the editor to controls implemented by both CSS and libass. */
export const EDITOR_STYLE: CaptionStyle = {
  ...DEFAULT_CAPTION_STYLE, fontWeight: 700, animation: 'none', wordSpacing: 0,
  fontSize: 48, yOffset: 80,
  highlight: { enabled: true, activeColor: '#ffe600', activeScale: 1, activeBold: false },
  highlightColor: '#ffe600',
};

export function validateDocument(value: unknown, duration: number): asserts value is CaptionDocument {
  const d = value as CaptionDocument;
  if (!d || !Array.isArray(d.captions) || d.captions.length > 10000 || !d.style) throw new Error('Invalid caption document.');
  const ids = new Set<string>();
  let previousEnd = 0;
  for (const c of d.captions) {
    if (!c || typeof c.id !== 'string' || ids.has(c.id)) throw new Error('Caption IDs must be unique.');
    ids.add(c.id);
    if (!Number.isFinite(c.start) || !Number.isFinite(c.end) || c.start < previousEnd - 0.001 || c.end <= c.start || c.end > duration + 0.01) throw new Error('Captions must have positive duration, stay inside the video, and not overlap.');
    if (typeof c.text !== 'string' || !c.text.trim() || c.text.length > 2000 || /[\r\n]/.test(c.text)) throw new Error('Each caption needs one nonempty line (maximum 2000 characters).');
    if (!Array.isArray(c.words) || !c.words.length || c.words.length > 300) throw new Error('Each caption needs timed words.');
    let end = c.start;
    for (const w of c.words) {
      if (typeof w.id !== 'string' || typeof w.text !== 'string' || !w.text.trim() || /\s/.test(w.text) || !Number.isFinite(w.start) || !Number.isFinite(w.end) || w.start < end - 0.001 || w.end <= w.start || w.end > c.end + 0.001) throw new Error('Word times must be ordered and inside their caption.');
      end = w.end;
    }
    if (c.text !== c.words.map((w) => w.text).join(' ')) throw new Error('Caption text and words do not match.');
    previousEnd = c.end;
  }
  const s = d.style;
  if (s.devanagariFont !== undefined && !DEVANAGARI_FONTS.includes(s.devanagariFont as never)) throw new Error('Unsupported fallback font.');
  if (s.positionX !== undefined && (!Number.isFinite(s.positionX) || s.positionX < .08 || s.positionX > .92)) throw new Error('Position must be within the safe area.');
  if (s.positionY !== undefined && (!Number.isFinite(s.positionY) || s.positionY < .08 || s.positionY > .92)) throw new Error('Position must be within the safe area.');
  if (s.animationStrength !== undefined && (!Number.isFinite(s.animationStrength) || s.animationStrength < 0 || s.animationStrength > 1)) throw new Error('Animation strength must be between 0 and 1.');
  if (s.wordEffect !== undefined && !['plain', 'marker', 'neon'].includes(s.wordEffect)) throw new Error('Unsupported word effect.');
  if (!Number.isInteger(s.maxWordsPerGroup) || s.maxWordsPerGroup < 1 || s.maxWordsPerGroup > 12) throw new Error('Words per caption must be between 1 and 12.');
  if (s.opacity !== undefined && (!Number.isFinite(s.opacity) || s.opacity < 0 || s.opacity > 1)) throw new Error('Opacity must be between 0 and 1.');
  if (s.alignment !== undefined && !['left', 'center', 'right'].includes(s.alignment)) throw new Error('Invalid alignment.');
  const color = (v: unknown) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
  const range = (v: number, min: number, max: number) => Number.isFinite(v) && v >= min && v <= max;
  if (!CAPTION_FONTS.includes(s.font) || ![400, 700].includes(s.fontWeight) || !range(s.fontSize, 16, 160) || !color(s.color) || !color(s.highlightColor) || !s.stroke || !color(s.stroke.color) || !range(s.stroke.width, 0, 10) || !s.shadow || !color(s.shadow.color) || !range(s.shadow.offsetY, 0, 10) || !s.background || !color(s.background.color) || !range(s.background.opacity, 0, 1) || !['top', 'center', 'bottom'].includes(s.position) || !range(s.yOffset, 0, 2000) || !s.highlight || typeof s.highlight.enabled !== 'boolean' || !['none', 'fade', 'pop', 'bounce', 'karaoke', 'typewriter'].includes(s.animation)) throw new Error('Unsupported caption style.');
}

/** Line corrections preserve word timings when the token count stays the same. */
export function replaceLine(c: Caption, text: string): Caption {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  const words = tokens.map((text, i) => c.words.length === tokens.length
    ? { ...c.words[i]!, text }
    : { id: globalThis.crypto.randomUUID(), transcriptWordId: '', text, start: c.start + (c.end - c.start) * i / tokens.length, end: c.start + (c.end - c.start) * (i + 1) / tokens.length });
  return { ...c, text, words };
}

export function retimeCaption(c: Caption, start: number, end: number): Caption {
  if (c.end <= c.start || c.words.some(w => !Number.isFinite(w.start) || !Number.isFinite(w.end))) {
    return { ...c, start, end, words: c.words.map((w, i) => ({ ...w, start: start + (end-start)*i/c.words.length, end: start + (end-start)*(i+1)/c.words.length })) };
  }
  const scale = (end - start) / (c.end - c.start);
  return { ...c, start, end, words: c.words.map((w) => ({ ...w, start: start + (w.start - c.start) * scale, end: start + (w.end - c.start) * scale })) };
}
