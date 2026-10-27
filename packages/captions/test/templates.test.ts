import { it, expect } from 'vitest';
import { CAPTION_TEMPLATES, TEMPLATE_CATEGORIES, templateStyle, parseCustomTemplate, validateDocument, BUNDLED_FONTS, LEGACY_SYSTEM_FONTS } from '../src';
import { parseGenerationOptions, CAPTION_TEMPLATE_IDS } from '@clipx/types';
import legacy from './legacy-template-styles.json';
const LEGACY_CATEGORIES: Record<string, string[]> = {
  bold: ['bold-yellow-pop', 'pop-box', 'bounce-word', 'marker-highlight', 'creator', 'gold'],
  minimal: ['clean-minimal', 'typewriter', 'minimal', 'contrast', 'clean'],
  podcast: ['karaoke-fill', 'rose', 'boxed'], gaming: ['neon-gaming', 'mint', 'electric'], luxury: ['editorial'],
};
it('has 40 unique templates matching CAPTION_TEMPLATE_IDS', () => {
  const ids = CAPTION_TEMPLATES.map(t => t.id);
  expect(ids.length).toBe(40);
  expect(new Set(ids).size).toBe(40);
  expect([...ids].sort()).toEqual([...CAPTION_TEMPLATE_IDS].sort());
});
it('every template is valid, categorized, tagged and uses known fonts', () => {
  const known = (f: string) => f in BUNDLED_FONTS || (LEGACY_SYSTEM_FONTS as readonly string[]).includes(f);
  for (const t of CAPTION_TEMPLATES) {
    expect(TEMPLATE_CATEGORIES.map(c => c.id)).toContain(t.category);
    expect(t.tags.length).toBeGreaterThanOrEqual(2);
    expect(t.name.length).toBeLessThanOrEqual(40);
    expect(() => validateDocument({ captions: [], style: t.style }, 0)).not.toThrow();
    expect(known(t.style.font)).toBe(true);
    expect(known(t.style.devanagariFont ?? 'Noto Sans Devanagari')).toBe(true);
  }
});
it('keeps the 18 legacy templates unchanged with their categories', () => {
  for (const [cat, ids] of Object.entries(LEGACY_CATEGORIES)) for (const id of ids) {
    expect(CAPTION_TEMPLATES.find(t => t.id === id)?.category).toBe(cat);
    expect(templateStyle(id, 1080)).toEqual((legacy as Record<string, unknown>)[id]);
  }
});
it('has the expected category counts and Hindi sizing', () => {
  const count = (c: string) => CAPTION_TEMPLATES.filter(t => t.category === c).length;
  expect(['bold', 'minimal', 'podcast', 'gaming', 'luxury', 'hindi'].map(count)).toEqual([10, 8, 7, 6, 3, 6]);
  expect(templateStyle('desi-pop', 1080).fontSize).toBe(Math.round(1080 * .055 * 1.25 * 1.15));
  expect(templateStyle('bollywood-marquee', 1080).fontSize).toBe(Math.round(1080 * .055 * 1.25 * 1.3));
  expect(templateStyle('saaf', 1080).fontSize).toBe(Math.round(1080 * .055 * 1.25));
  expect(templateStyle('noir', 1080).fontSize).toBeGreaterThan(templateStyle('whisper', 1080).fontSize);
  expect(templateStyle('shout', 1080).fontSize).toBe(Math.round(1080 * .055));
  expect(templateStyle('desi-pop', 4320).fontSize).toBe(160);
});
it('accepts new template ids in generation options', () => {
  expect(parseGenerationOptions({ outputLanguage: 'hinglish', templateId: 'desi-pop' }).templateId).toBe('desi-pop');
});
it('validates all presets at landscape and portrait resolutions', () => {
  for (const height of [360, 1080, 1920, 4320]) for (const template of CAPTION_TEMPLATES) {
    expect(templateStyle(template.id, height).id).toBe(template.id);
    expect(() => validateDocument({ captions: [], style: templateStyle(template.id, height) }, 0)).not.toThrow();
  }
});
it('rejects unsupported output languages, templates and unsafe imported styles', () => {
  expect(() => parseGenerationOptions({ outputLanguage: 'hi' })).toThrow();
  expect(parseGenerationOptions({ outputMode: 'srt' }).outputMode).toBe('srt');
  expect(() => parseGenerationOptions({ outputMode: 'invalid' })).toThrow();
  expect(() => parseGenerationOptions({ templateId: '../file' })).toThrow();
  expect(parseGenerationOptions({ outputLanguage: 'english', templateId: 'gold' })).toEqual({ outputLanguage: 'english', templateId: 'gold' });
  expect(() => parseCustomTemplate({ name: 'test', style: { ...templateStyle('gold', 1080), font: 'arbitrary' } })).toThrow();
  expect(parseCustomTemplate({ name: 'Custom', style: templateStyle('gold', 1080) }).style.font).toBe('Anton');
});
it('rejects fonts outside the import allowlist', () => {
  const style = templateStyle('gold', 1080);
  expect(() => parseCustomTemplate({ name: 'x', style: { ...style, font: 'Comic Sans MS' } })).toThrow();
  expect(() => parseCustomTemplate({ name: 'x', style: { ...style, devanagariFont: 'Arial' } })).toThrow();
});
