import { BUNDLED_FONTS, type BundledFont } from './fonts';
import type { BurnGroup, BurnWord, Caption, CaptionStyle } from '@clipx/types';

const segmenter = new Intl.Segmenter('hi', { granularity: 'grapheme' });
export const graphemes = (text: string): string[] => Array.from(segmenter.segment(text), s => s.segment);
export const captionFont = (text: string, style: CaptionStyle): string => /\p{Script=Devanagari}/u.test(text) ? style.devanagariFont ?? 'Noto Sans Devanagari' : style.font;
export const ANIMATIONS = ['none', 'fade', 'pop', 'bounce', 'karaoke', 'typewriter'] as const;

/** libass sizes the OS/2 Windows cell; CSS sizes unitsPerEm. Metrics of bundled TTFs. */
export function assFontSize(font: string, cssPixels: number): number {
  return cssPixels * (BUNDLED_FONTS[font as BundledFont]?.cellToEm ?? 1);
}

/** Conservative fit for a single line, reserving room for outline and pop overshoot. */
export function fitCaptionStyle(group: BurnGroup, style: CaptionStyle, width: number): CaptionStyle {
  const ems = group.words.reduce((sum, w) => sum + graphemes(w.text).reduce((n, g) => n + (/\p{Script=Devanagari}/u.test(g) ? 1.4 : /[MW@]/.test(g) ? 1 : .7), 0), 0) + Math.max(0, group.words.length - 1) * .4;
  const lineWidth = style.positionX === undefined ? .84 : Math.min(.84, 2 * Math.min(style.positionX, 1 - style.positionX));
  const available = Math.max(1, width * lineWidth - 2 * style.stroke.width - 8);
  return { ...style, fontSize: Math.min(style.fontSize, available / Math.max(1, ems * 1.16)) };
}

/** Seekable, deterministic state shared by the browser and libass. No wall clock. */
export function wordPresentation(word: BurnWord, group: BurnGroup, style: CaptionStyle, time: number, staticOnly = false) {
  const strength = staticOnly ? 0 : style.animationStrength ?? 1;
  const active = !staticOnly && time >= word.start && time < word.end;
  const progress = Math.max(0, Math.min(1, (time - word.start) / Math.max(.001, word.end - word.start)));
  const emphasized = style.highlight.enabled && (active || (!staticOnly && style.animation === 'karaoke' && time >= word.end));
  const pulse = active ? Math.sin(Math.PI * Math.min(1, (time - word.start) / .22)) : 0;
  const clusters = graphemes(word.text);
  const marker = style.wordEffect === 'marker' && emphasized;
  const rgb = [1, 3, 5].map(i => parseInt(style.highlightColor.slice(i, i + 2), 16));
  const markerText = .299 * rgb[0]! + .587 * rgb[1]! + .114 * rgb[2]! > 150 ? '#111111' : '#FFFFFF';
  const count = style.animation === 'typewriter' && strength > 0
    ? (time < word.start ? 0 : Math.min(clusters.length, Math.floor(progress / strength * clusters.length + 1e-7) + 1)) : clusters.length;
  return {
    active, color: marker ? markerText : emphasized ? style.highlightColor : style.color,
    scale: style.animation === 'pop' ? 1 + .16 * strength * pulse : 1,
    lift: style.animation === 'bounce' ? -.18 * style.fontSize * strength * pulse : 0,
    opacity: style.animation === 'fade' && strength > 0 ? Math.max(0, Math.min(1, (time - group.start) / (.12 * strength), (group.end - time) / (.12 * strength))) : 1,
    visible: clusters.slice(0, count).join(''), hidden: clusters.slice(count).join(''),
    marker,
    glow: style.wordEffect === 'neon' && emphasized ? 2 * strength : 0,
    font: captionFont(word.text, style),
  };
}

/** Centisecond ticks match ASS time precision; static styles emit only word boundaries. */
export function presentationBoundaries(group: BurnGroup, style: CaptionStyle, staticOnly = false): number[] {
  const points = new Set([group.start, group.end]);
  if (!staticOnly) {
    for (const w of group.words) {
      points.add(Math.max(group.start, w.start)); points.add(Math.min(group.end, w.end));
      if ((style.animationStrength ?? 1) > 0 && style.animation === 'typewriter') {
        const count = graphemes(w.text).length;
        for (let i = 1; i < count; i++) points.add(w.start + (w.end - w.start) * (style.animationStrength ?? 1) * i / count);
      }
      if ((style.animationStrength ?? 1) > 0 && ['pop', 'bounce'].includes(style.animation)) {
        const end = Math.min(w.end, w.start + .22);
        for (let t = Math.ceil(w.start * 100 / 4) * 4; t < end * 100; t += 4) points.add(t / 100);
        points.add(end);
      }
    }
    if (style.animation === 'fade') for (let i = 0; i <= 12; i += 4) { points.add(group.start + i / 100 * (style.animationStrength ?? 1)); points.add(group.end - i / 100 * (style.animationStrength ?? 1)); }
  }
  return [...points].filter(t => t >= group.start && t <= group.end).sort((a, b) => a - b);
}

export function presentationTime(group: BurnGroup, style: CaptionStyle, time: number): number {
  // Quantize motion identically to the exported subtitle events, preserving actual word onsets.
  let at = group.start;
  for (const t of presentationBoundaries(group, style)) { if (t > time) break; at = t; }
  return at;
}

export function captionPosition(style: CaptionStyle, width: number, height: number) {
  const align = style.positionX !== undefined ? 'center' : style.alignment ?? 'center';
  const vertical = style.positionY !== undefined ? 'center' : style.position;
  return {
    x: Math.round(width * (style.positionX ?? (align === 'left' ? .08 : align === 'right' ? .92 : .5))),
    y: Math.round(style.positionY !== undefined ? height * style.positionY : style.position === 'top' ? style.yOffset : style.position === 'center' ? height / 2 : height - style.yOffset),
    anchor: (vertical === 'top' ? 7 : vertical === 'center' ? 4 : 1) + (align === 'left' ? 0 : align === 'right' ? 2 : 1),
    translateX: align === 'left' ? '0%' : align === 'right' ? '-100%' : '-50%',
    translateY: vertical === 'top' ? '0%' : vertical === 'center' ? '-50%' : '-100%',
  };
}

/** Repage contiguous speech, retaining every word, ID and absolute timestamp. */
export function repageCaptions(captions: Caption[], count: number): Caption[] {
  if (!Number.isInteger(count) || count < 1 || count > 12) throw new Error('Words per caption must be 1–12.');
  const pages: Caption[] = [];
  for (const c of captions) for (const word of c.words) {
    const last = pages.at(-1);
    if (last && last.words.length < count && word.start - last.end <= .35 && last.clipId === c.clipId && last.script === c.script) {
      last.words.push({ ...word }); last.end = word.end; last.text += ' ' + word.text;
    } else pages.push({ ...c, id: globalThis.crypto.randomUUID(), words: [{ ...word }], text: word.text, start: word.start, end: word.end, order: pages.length });
  }
  return pages;
}
