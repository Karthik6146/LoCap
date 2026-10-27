import { it, expect } from 'vitest';
import { EDITOR_STYLE, replaceLine, retimeCaption, validateDocument, captionsToSrt, HistoryStack, CAPTION_FONTS, DEVANAGARI_FONTS } from '../src';
import type { Caption } from '@clipx/types';
const caption: Caption = { id: 'a', clipId: '', script: 'en', grouping: 'custom', order: 0, styleId: 'editor', text: 'hello world', start: 1, end: 3, words: [{ id: 'a', transcriptWordId: 't1', text: 'hello', start: 1, end: 1.8 }, { id: 'b', transcriptWordId: 't2', text: 'world', start: 2, end: 3 }] };
it('keeps word timing for equal-length corrections; retimes and serializes edited text', () => {
  const edited = replaceLine(caption, 'नमस्ते world');
  expect(edited.words[0]!.start).toBe(1);
  const timed = retimeCaption(edited, 2, 4);
  validateDocument({ captions: [timed], style: EDITOR_STYLE }, 5);
  expect(captionsToSrt([timed])).toContain('00:00:02,000 --> 00:00:04,000\nनमस्ते world');
});
it('rejects overlap, empty text, nonfinite times and words outside a segment', () => {
  const check = (captions: Caption[]) => validateDocument({ captions, style: EDITOR_STYLE }, 10);
  expect(() => check([caption, { ...caption, id: 'b' }])).toThrow(/overlap/);
  expect(() => check([{ ...caption, text: '' }])).toThrow();
  expect(() => check([{ ...caption, end: NaN }])).toThrow();
  expect(() => check([{ ...caption, words: [{ ...caption.words[0]!, start: 0 }] }])).toThrow();
});
it('undoes and redoes text/timing snapshots together', () => {
  const history = new HistoryStack<Caption>();
  history.record(caption);
  const changed = retimeCaption(replaceLine(caption, 'good morning'), 2, 4);
  expect(history.undo(changed)).toEqual(caption);
  expect(history.redo(caption)).toEqual(changed);
});
it('validates fonts against the registry allowlist', () => {
  const check = (style: object) => validateDocument({ captions: [caption], style: { ...EDITOR_STYLE, ...style } }, 5);
  for (const font of CAPTION_FONTS) expect(() => check({ font })).not.toThrow();
  for (const devanagariFont of DEVANAGARI_FONTS) expect(() => check({ devanagariFont })).not.toThrow();
  expect(() => check({ font: 'Comic Sans MS' })).toThrow();
  expect(() => check({ devanagariFont: 'Playfair Display' })).toThrow();
  expect(() => check({ font: 'Anton', fontWeight: 700 })).not.toThrow();
});
