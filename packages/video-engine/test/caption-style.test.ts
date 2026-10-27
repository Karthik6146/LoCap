import { it, expect } from 'vitest';
import { buildAss, burnCaptions } from '../src/captions';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { assertBundledFonts } from '../src/fonts';
import { EDITOR_STYLE } from '@clipx/captions';
it('uses actual word starts, holds the line in gaps and after the last word, and supports alignment/opacity', () => {
  const ass = buildAss([{ start: 0, end: 3, words: [{ text: 'one', start: .5, end: 1 }, { text: 'two', start: 1.5, end: 2 }] }], { ...EDITOR_STYLE, alignment: 'right', opacity: .5 }, 640, 360);
  expect(ass).toContain('\\an3\\pos(589,280)');
  expect(ass).toContain('Dialogue: 0,00:00:00.00,00:00:00.50');
  expect(ass).toContain('Dialogue: 0,00:00:02.00,00:00:03.00');
  expect(ass).toContain('\\1a&H80&');
  expect(ass).not.toContain('\u0008');
});
it('exports custom horizontal and vertical caption coordinates with a center anchor', () => {
  const style = { ...EDITOR_STYLE, positionX: .3, positionY: .4 };
  const group = { start: 0, end: 1, words: [{ text: 'caption', start: 0, end: 1 }] };
  expect(buildAss([group], style, 640, 360)).toContain('\\an5\\pos(192,144)');
});
it('assertBundledFonts rejects an empty dir and passes for the bundled fonts dir', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'fonts-'));
  await expect(assertBundledFonts(dir)).rejects.toThrow('is missing');
  await expect(assertBundledFonts()).resolves.toBeUndefined();
});
it('burnCaptions rejects before FFmpeg when fonts are missing', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'fonts-'));
  await expect(burnCaptions({} as never, 'in.mp4', path.join(dir, 'out.mp4'), { groups: [], style: EDITOR_STYLE, width: 640, height: 360, fontsDir: dir })).rejects.toThrow('is missing');
});
