import { it, expect } from 'vitest';
import { ANIMATED_TEMPLATE_CONFIGS, BUNDLED_FONTS, CAPTION_TEMPLATES, DEVANAGARI_FONTS, graphemes, bundledFontFiles, assFontSize, fitCaptionStyle, templateStyle, wordPresentation } from '@clipx/captions';
import { buildAss, burnCaptions, generateTestVideo, probeVideo } from '../src';
import { tmpDir, testEnv } from './helpers';
import { readFile, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';

const samples = ['Aaj hum website bana rahe', 'आज website क्षेत्र में है'].map(text => ({ start: 0, end: 2, words: text.split(' ').map((text, i) => ({ text, start: i * .3, end: i * .3 + .25 })) }));
it('matches ASS-to-CSS font scaling to the actual bundled font metrics', async () => {
  for (const [family, { files }] of Object.entries(BUNDLED_FONTS)) for (const file of Object.values(files)) {
    const bytes = await readFile(new URL(`../../../apps/web/public/fonts/${file}`, import.meta.url));
    const tables: Record<string, number> = {};
    for (let i = 0; i < bytes.readUInt16BE(4); i++) { const offset = 12 + i * 16; tables[bytes.toString('ascii', offset, offset + 4)] = bytes.readUInt32BE(offset + 8); }
    const em = bytes.readUInt16BE(tables.head! + 18);
    const cell = bytes.readUInt16BE(tables['OS/2']! + 74) + bytes.readUInt16BE(tables['OS/2']! + 76);
    expect(assFontSize(family, 20)).toBeCloseTo(20 * cell / em);
  }
});
it('bundles every registry file', async () => {
  const dir = new URL('../../../apps/web/public/fonts/', import.meta.url);
  for (const file of bundledFontFiles()) await stat(new URL(file, dir));
  const added = ['Poppins-Regular', 'Poppins-Bold', 'Baloo2-Bold', 'RozhaOne-Regular', 'Teko-Bold', 'PlayfairDisplay-Bold'];
  let total = 0;
  for (const f of added) total += (await stat(new URL(`${f}.ttf`, dir))).size;
  expect(total).toBeLessThanOrEqual(3 * 1024 * 1024);
});
it('serializes shared animation states and script fonts, without unsafe control bytes', () => {
  for (const config of ANIMATED_TEMPLATE_CONFIGS) for (const group of samples) {
    const style = templateStyle(config.id, 360), ass = buildAss([group], style, 640, 360);
    expect(ass).toContain('\\pos(320,245)');
    expect(ass).not.toMatch(/[\x00-\x08\x0b\x0c\x0e-\x1f]/);
    if (/क्षेत्र/.test(group.words.map(w => w.text).join(' '))) expect(ass).toContain('\\fnNoto Sans Devanagari');
    const state = wordPresentation(group.words[0]!, group, fitCaptionStyle(group, style, 640), 0);
    expect(ass).toContain('\\fn' + state.font);
    expect(ass).toContain(state.visible);
  }
});
const group = (text: string) => ({ start: 0, end: 2, words: text.split(' ').map((text, i) => ({ text, start: i * .3, end: i * .3 + .25 })) });
// em weights must mirror fitCaptionStyle in packages/captions/src/presentation.ts
const emsOf = (g: ReturnType<typeof group>) => g.words.reduce((s, w) => s + graphemes(w.text).reduce((n, c) => n + (/\p{Script=Devanagari}/u.test(c) ? 1.4 : /[MW@]/.test(c) ? 1 : .7), 0), 0) + (g.words.length - 1) * .4;
const sizes = [[1080, 1920], [1920, 1080], [1080, 1080]] as const;
it('serializes every template for Roman, mixed and Devanagari lines', () => {
  for (const { id } of CAPTION_TEMPLATES) for (const text of ['Aaj hum website bana rahe', 'आज website क्षेत्र में है', 'आज कुछ नया सीखते हैं']) for (const [w, h] of sizes) {
    const g = group(text), style = templateStyle(id, h), ass = buildAss([g], style, w, h);
    expect(ass, id).not.toMatch(/[\x00-\x08\x0b\x0c\x0e-\x1f]/);
    if (g.words.some(x => /\p{Script=Devanagari}/u.test(x.text))) {
      const family = style.devanagariFont ?? 'Noto Sans Devanagari';
      expect(DEVANAGARI_FONTS as readonly string[], id).toContain(family);
      expect(ass, id).toContain('\\fn' + family);
    }
    expect(fitCaptionStyle(g, style, w).fontSize, id).toBeLessThanOrEqual(style.fontSize);
  }
});
it('fits long Devanagari and mixed lines within 84% width for every template and aspect', () => {
  for (const { id } of CAPTION_TEMPLATES) for (const text of ['प्रधानमंत्री राष्ट्रीय स्वास्थ्य कार्यक्रम घोषणा', 'आज website क्षेत्र में है']) for (const [w, h] of sizes) {
    const g = group(text), fitted = fitCaptionStyle(g, templateStyle(id, h), w).fontSize;
    expect(emsOf(g) * fitted * 1.16, id + ' ' + w + 'x' + h).toBeLessThanOrEqual(w * .84);
  }
});
it('burns every template with Roman and mixed-script captions at all requested aspect ratios', async () => {
  const dir = await tmpDir('animated-templates');
  try {
    for (const [width, height] of [[360, 640], [640, 360], [480, 480]]) {
      const source = join(dir, `source-${width}.mp4`);
      await generateTestVideo(testEnv, { outFile: source, duration: 4, width, height });
      for (const config of CAPTION_TEMPLATES) {
        const output = join(dir, `${width}-${config.id}.mp4`);
        await burnCaptions(testEnv, source, output, { width: width!, height: height!, style: templateStyle(config.id, height!), groups: [samples[0]!, { ...samples[1]!, start: 2, end: 4, words: samples[1]!.words.map(w => ({ ...w, start: w.start + 2, end: w.end + 2 })) }] });
        const meta = await probeVideo(testEnv, output);
        expect(meta.width).toBe(width); expect(meta.height).toBe(height); expect(meta.audioCodec).toBe('aac');
      }
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
}, 180000);
