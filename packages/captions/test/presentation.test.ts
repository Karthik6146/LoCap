import { expect, it } from 'vitest';
import { ANIMATED_TEMPLATE_CONFIGS, CAPTION_TEMPLATES, EDITOR_STYLE, captionFont, captionPosition, fitCaptionStyle, graphemes, parseCustomTemplate, repageCaptions, templateStyle, validateDocument, wordPresentation } from '../src';
import { CAPTION_TEMPLATE_IDS, type Caption } from '@clipx/types';

const group = { start: 0, end: 3, words: [{ text: 'kaafi', start: .2, end: .8 }, { text: 'क्षेत्र', start: 1, end: 1.5 }, { text: 'development', start: 1.6, end: 2.4 }] };
it('loads the eight unique configurations and accepts them in generation', () => {
  expect(ANIMATED_TEMPLATE_CONFIGS).toHaveLength(8);
  expect(new Set(CAPTION_TEMPLATES.map(t => t.id)).size).toBe(CAPTION_TEMPLATES.length);
  for (const config of ANIMATED_TEMPLATE_CONFIGS) expect(CAPTION_TEMPLATE_IDS).toContain(config.id);
  const a = templateStyle('bold-yellow-pop', 1080); a.stroke.width = 0;
  expect(templateStyle('bold-yellow-pop', 1080).stroke.width).toBe(4);
});
it('highlights real starts/ends without highlighting silence and accumulates karaoke fill', () => {
  const style = templateStyle('bold-yellow-pop', 1080), word = group.words[0]!;
  expect(wordPresentation(word, group, style, .1).active).toBe(false);
  expect(wordPresentation(word, group, style, .2).color).toBe('#FFD400');
  expect(wordPresentation(word, group, style, .8).active).toBe(false);
  expect(wordPresentation(word, group, templateStyle('karaoke-fill', 1080), 1).color).toBe('#5EF2BA');
  expect(wordPresentation(word, group, { ...style, animationStrength: 0 }, .3).scale).toBe(1);
});
it('preserves Hindi matras, conjuncts, combining marks and emoji graphemes', () => {
  for (const cluster of ['क्षि', 'कि', 'स्त्री', 'e\u0301', '👩🏽‍💻']) expect(graphemes(cluster)).toEqual([cluster]);
  const style = templateStyle('typewriter', 1080), word = { text: 'क्षिक्षि', start: 0, end: 2 };
  const state = wordPresentation(word, { ...group, words: [word] }, style, .2);
  expect(state.visible).toBe('क्षि'); expect(state.hidden).toBe('क्षि');
  expect(wordPresentation(word, group, { ...style, animationStrength: .2 }, .2).visible).toBe('क्षिक्षि');
  expect(state.visible + state.hidden).toBe(word.text);
  expect(captionFont('website', style)).toBe('Montserrat');
  expect(captionFont('websiteहै', style)).toBe('Noto Sans Devanagari');
});
it('keeps marker text readable on light and dark custom highlight colors', () => {
  const style = templateStyle('marker-highlight', 1080), word = group.words[0]!;
  expect(wordPresentation(word, group, style, .3).color).toBe('#111111');
  expect(wordPresentation(word, group, { ...style, highlightColor: '#000055' }, .3).color).toBe('#FFFFFF');
});
it('round-trips customization and rejects unsafe or unsupported values', () => {
  const style = { ...templateStyle('bounce-word', 1080), positionY: .3, animationStrength: .4, maxWordsPerGroup: 6 };
  expect(parseCustomTemplate({ name: 'My bounce', style }).style).toEqual(style);
  for (const patch of [{ positionY: 2 }, { animationStrength: NaN }, { maxWordsPerGroup: 0 }, { devanagariFont: 'bad' }, { wordEffect: 'bad' }]) expect(() => validateDocument({ captions: [], style: { ...style, ...patch } }, 0)).toThrow();
});
it.each([[1080, 1920], [1920, 1080], [1080, 1080]])('positions and fits text inside %ix%i', (width, height) => {
  const style = templateStyle('bold-yellow-pop', height), position = captionPosition(style, width, height);
  expect(position.x).toBe(width / 2); expect(position.y).toBe(Math.round(height * .68));
  const fitted = fitCaptionStyle(group, style, width);
  expect(fitted.fontSize).toBeLessThanOrEqual(style.fontSize);
  expect(fitted.fontSize).toBeGreaterThan(0);
});
it.each([[1080, 1920], [1920, 1080], [1080, 1080]])('preserves custom drag coordinates in %ix%i', (width, height) => {
  const style = { ...templateStyle('bold-yellow-pop', height), positionX: .3, positionY: .4, alignment: 'right' as const };
  expect(captionPosition(style, width, height)).toMatchObject({ x: Math.round(width * .3), y: Math.round(height * .4), anchor: 5, translateX: '-50%', translateY: '-50%' });
  expect(parseCustomTemplate({ name: 'Dragged caption', style }).style).toEqual(style);
});
it('validates horizontal custom positions and fits future longer lines near the edge', () => {
  const style = { ...templateStyle('bold-yellow-pop', 1080), positionX: .1, positionY: .4 };
  for (const positionX of [-1, 1, NaN, Infinity, '0.3']) expect(() => validateDocument({ captions: [], style: { ...style, positionX } }, 0)).toThrow();
  expect(fitCaptionStyle(group, style, 640).fontSize).toBeLessThan(fitCaptionStyle(group, { ...style, positionX: .5 }, 640).fontSize);
});
it('changes page size both ways without retranscription or changing mixed-script words/times', () => {
  const original: Caption[] = [{ ...group, id: 'c', clipId: '', script: 'mixed', grouping: 'auto', order: 0, styleId: 'x', text: 'kaafi क्षेत्र development', words: group.words.map((w, i) => ({ ...w, id: String(i), transcriptWordId: String(i) })) }];
  const small = repageCaptions(original, 1), large = repageCaptions(small, 4);
  expect(small).toHaveLength(3); expect(large).toHaveLength(1);
  expect(large.flatMap(c => c.words)).toEqual(original.flatMap(c => c.words));
  expect(original).toHaveLength(1);
});
it('uses the template Devanagari font', () => {
  expect(captionFont('आज', { ...EDITOR_STYLE, devanagariFont: 'Baloo 2' })).toBe('Baloo 2');
  expect(captionFont('आज', EDITOR_STYLE)).toBe('Noto Sans Devanagari');
  expect(captionFont('aaj', { ...EDITOR_STYLE, font: 'Poppins', devanagariFont: 'Baloo 2' })).toBe('Poppins');
});
