import type { CaptionStyle } from '@clipx/types';
import { EDITOR_STYLE, validateDocument } from './document';
import { BUNDLED_FONTS, DEVANAGARI_FONTS, type BundledFont } from './fonts';
export type TemplateCategory = 'bold' | 'minimal' | 'podcast' | 'gaming' | 'luxury' | 'hindi';
export const TEMPLATE_CATEGORIES: readonly { id: TemplateCategory; label: string }[] = [
  { id: 'bold', label: 'Bold' }, { id: 'minimal', label: 'Minimal' }, { id: 'podcast', label: 'Podcast' },
  { id: 'gaming', label: 'Gaming' }, { id: 'luxury', label: 'Luxury' }, { id: 'hindi', label: 'Hindi' },
];
export interface CaptionTemplate { id: string; name: string; description: string; category: TemplateCategory; tags: string[]; style: CaptionStyle }
function preset(id: string, name: string, description: string, patch: Partial<CaptionStyle>): CaptionTemplate {
  return { id, name, description, category: 'bold', tags: [], style: { ...EDITOR_STYLE, ...patch, id, name } };
}
const LEGACY_META: Record<string, [TemplateCategory, string[]]> = {
  'bold-yellow-pop': ['bold', ['yellow', 'pop', 'outline']], 'pop-box': ['bold', ['box', 'pop', 'white']],
  'bounce-word': ['bold', ['orange', 'bounce', 'lively']], 'marker-highlight': ['bold', ['marker', 'yellow', 'highlight']],
  creator: ['bold', ['yellow', 'anton', 'punchy']], gold: ['bold', ['gold', 'anton', 'shadow']],
  'clean-minimal': ['minimal', ['white', 'fade', 'quiet']], typewriter: ['minimal', ['typewriter', 'white', 'retro']],
  minimal: ['minimal', ['white', 'simple', 'quiet']], contrast: ['minimal', ['box', 'dark', 'clear']],
  clean: ['minimal', ['white', 'timeless', 'plain']], 'karaoke-fill': ['podcast', ['karaoke', 'mint', 'fill']],
  rose: ['podcast', ['pink', 'karaoke', 'soft']], boxed: ['podcast', ['box', 'navy', 'contrast']],
  'neon-gaming': ['gaming', ['neon', 'cyan', 'glow']], mint: ['gaming', ['mint', 'bright', 'anton']],
  electric: ['gaming', ['cyan', 'impact', 'edgy']], editorial: ['luxury', ['serif', 'cream', 'fade']],
};
/** New templates only: devanagariFont is the font itself when Devanagari-capable, else Poppins. */
function fresh(id: string, name: string, category: TemplateCategory, tags: string[], font: BundledFont, fontWeight: 400 | 700, patch: Partial<CaptionStyle> & { hl?: string }): CaptionTemplate {
  const { hl, ...rest } = patch;
  const base: Partial<CaptionStyle> = {
    font, fontWeight, devanagariFont: (DEVANAGARI_FONTS as string[]).includes(font) ? font : 'Poppins', positionY: .68,
    highlight: { ...EDITOR_STYLE.highlight, enabled: !!hl, activeColor: hl ?? EDITOR_STYLE.highlight.activeColor },
    ...(hl ? { highlightColor: hl } : {}),
  };
  return { ...preset(id, name, tags.join(' · '), { ...base, ...rest }), category, tags };
}
const stroke = (width: number) => ({ ...EDITOR_STYLE.stroke, width });
const box = (color: string, opacity: number) => ({ ...EDITOR_STYLE.background, enabled: true, color, opacity, radius: 0 });
/** Original presets inspired by the MIT tscaps template configuration model. */
export const ANIMATED_TEMPLATE_CONFIGS = [
  { id: 'bold-yellow-pop', name: 'Bold Yellow Pop', animation: 'pop', activeColor: '#FFD400', outlineWidth: 4 },
  { id: 'karaoke-fill', name: 'Karaoke Fill', animation: 'karaoke', activeColor: '#5EF2BA', outlineWidth: 2 },
  { id: 'pop-box', name: 'Pop Box', animation: 'pop', activeColor: '#FFFFFF', outlineWidth: 0, box: true },
  { id: 'bounce-word', name: 'Bounce Word', animation: 'bounce', activeColor: '#FFB86B', outlineWidth: 3 },
  { id: 'clean-minimal', name: 'Clean Minimal', animation: 'fade', activeColor: '#FFFFFF', outlineWidth: 1, quiet: true },
  { id: 'neon-gaming', name: 'Neon Gaming', animation: 'pop', activeColor: '#38E8FF', outlineWidth: 2, effect: 'neon' },
  { id: 'marker-highlight', name: 'Marker Highlight', animation: 'none', activeColor: '#FFD400', outlineWidth: 0, effect: 'marker' },
  { id: 'typewriter', name: 'Typewriter', animation: 'typewriter', activeColor: '#FFFFFF', outlineWidth: 2 },
] satisfies { id: string; name: string; animation: CaptionStyle['animation']; activeColor: string; outlineWidth: number; box?: boolean; quiet?: boolean; effect?: CaptionStyle['wordEffect'] }[];
export const CAPTION_TEMPLATES: CaptionTemplate[] = [
  ...ANIMATED_TEMPLATE_CONFIGS.map(c => preset(c.id, c.name, 'Timed words · all scripts', {
    id: c.id, name: c.name, font: 'Montserrat', devanagariFont: 'Noto Sans Devanagari',
    fontWeight: 700, color: '#FFFFFF', highlightColor: c.activeColor,
    stroke: { color: '#000000', width: c.outlineWidth },
    shadow: { color: '#000000', offsetX: 0, offsetY: 0, blur: 0 },
    background: { enabled: !!c.box, color: '#111111', opacity: .9, radius: 0 },
    animation: c.animation, animationStrength: 1, wordEffect: c.effect ?? 'plain',
    maxWordsPerGroup: 4, positionY: .68,
    highlight: { ...EDITOR_STYLE.highlight, enabled: !c.quiet, activeColor: c.activeColor },
  })),
  preset('creator', 'Creator', 'Bold yellow word highlights', { font: 'Anton', fontWeight: 400, highlightColor: '#FFE600', maxWordsPerGroup: 3, stroke: { ...EDITOR_STYLE.stroke, width: 4 } }),
  preset('minimal', 'Minimal', 'Quiet white text for everyday stories', { font: 'Arial', fontWeight: 400, highlight: { ...EDITOR_STYLE.highlight, enabled: false }, maxWordsPerGroup: 5, stroke: { ...EDITOR_STYLE.stroke, width: 1 } }),
  preset('rose', 'Rose', 'Soft pink karaoke highlights', { font: 'Anton', fontWeight: 400, highlightColor: '#FDA4AF', maxWordsPerGroup: 3 }),
  preset('contrast', 'Contrast', 'Clear boxed captions for busy footage', { font: 'Arial', background: { ...EDITOR_STYLE.background, enabled: true, color: '#111111', opacity: .95, radius: 0 }, highlightColor: '#FDE047', maxWordsPerGroup: 4 }),
  preset('clean', 'Clean', 'Quiet, clear, timeless', { highlight: { ...EDITOR_STYLE.highlight, enabled: false } }),
  // Adapted from auto-caption (MIT). Unsupported scale-pop/sweep omitted.
  preset('gold', 'Spotlight', 'Bold words. Golden emphasis.', { font: 'Anton', fontWeight: 400, highlightColor: '#FFD700', stroke: { ...EDITOR_STYLE.stroke, width: 4 }, shadow: { ...EDITOR_STYLE.shadow, offsetY: 1.5 } }),
  preset('mint', 'Fresh', 'A bright mint speaking word', { font: 'Anton', fontWeight: 400, highlightColor: '#5EF2BA', stroke: { ...EDITOR_STYLE.stroke, width: 3 } }),
  preset('editorial', 'Editorial', 'Soft serif, subtle entrance', { font: 'Georgia', fontWeight: 400, color: '#FFF2D8', highlight: { ...EDITOR_STYLE.highlight, enabled: false }, animation: 'fade' }),
  preset('boxed', 'Focus', 'High contrast on any footage', { background: { ...EDITOR_STYLE.background, enabled: true, color: '#101522', opacity: .9, radius: 0 }, highlightColor: '#A5B4FC' }),
  preset('electric', 'Electric', 'Cyan with a little attitude', { font: 'Impact', highlightColor: '#38E8FF', stroke: { ...EDITOR_STYLE.stroke, width: 3 } }),
].map(t => { const [category, tags] = LEGACY_META[t.id]!; return { ...t, category, tags }; }).concat([
  fresh('shout', 'Shout', 'bold', ['loud', 'red', 'pop'], 'Poppins', 700, { hl: '#FF3B3B', animation: 'pop', maxWordsPerGroup: 2, stroke: stroke(4) }),
  fresh('punch', 'Punch', 'bold', ['white', 'box', 'black'], 'Poppins', 700, { hl: '#111111', color: '#111111', animation: 'pop', maxWordsPerGroup: 3, background: box('#FFFFFF', .95) }),
  fresh('headline', 'Headline', 'bold', ['news', 'yellow', 'tall'], 'Teko', 700, { hl: '#FFE14D', animation: 'bounce', maxWordsPerGroup: 3, stroke: stroke(3) }),
  fresh('sticker', 'Sticker', 'bold', ['pink', 'playful', 'chunky'], 'Baloo 2', 700, { hl: '#FF7AC6', animation: 'bounce', maxWordsPerGroup: 3, stroke: stroke(5) }),
  fresh('whisper', 'Whisper', 'minimal', ['light', 'soft', 'fade'], 'Poppins', 400, { animation: 'fade', maxWordsPerGroup: 5, stroke: stroke(1) }),
  fresh('subtitle-classic', 'Subtitle Classic', 'minimal', ['classic', 'low', 'plain'], 'Poppins', 400, { animation: 'none', maxWordsPerGroup: 7, positionY: .88 }),
  fresh('soft-box', 'Soft Box', 'minimal', ['box', 'dark', 'gentle'], 'Poppins', 400, { animation: 'fade', maxWordsPerGroup: 6, background: box('#000000', .6) }),
  fresh('talk-show', 'Talk Show', 'podcast', ['karaoke', 'blue', 'calm'], 'Poppins', 700, { hl: '#7DD3FC', animation: 'karaoke', maxWordsPerGroup: 5, stroke: stroke(2) }),
  fresh('interview', 'Interview', 'podcast', ['box', 'navy', 'amber'], 'Poppins', 400, { hl: '#FDE68A', animation: 'fade', maxWordsPerGroup: 6, background: box('#0B1220', .85) }),
  fresh('storyteller', 'Storyteller', 'podcast', ['serif', 'karaoke', 'rose'], 'Playfair Display', 700, { hl: '#FCA5A5', animation: 'karaoke', maxWordsPerGroup: 4 }),
  fresh('quote-card', 'Quote Card', 'podcast', ['quote', 'serif', 'warm'], 'Rozha One', 400, { hl: '#F5D0A9', animation: 'fade', maxWordsPerGroup: 5, background: box('#1A1410', .9) }),
  fresh('arcade', 'Arcade', 'gaming', ['neon', 'green', 'retro'], 'Teko', 700, { hl: '#39FF6A', animation: 'pop', wordEffect: 'neon', maxWordsPerGroup: 3 }),
  fresh('rage', 'Rage', 'gaming', ['red', 'angry', 'bounce'], 'Baloo 2', 700, { hl: '#FF4D4D', animation: 'bounce', maxWordsPerGroup: 2, stroke: stroke(6) }),
  fresh('level-up', 'Level Up', 'gaming', ['purple', 'marker', 'pop'], 'Teko', 700, { hl: '#A78BFA', animation: 'pop', wordEffect: 'marker', maxWordsPerGroup: 3 }),
  fresh('gold-serif', 'Gold Serif', 'luxury', ['gold', 'serif', 'elegant'], 'Playfair Display', 700, { hl: '#E8C36A', animation: 'fade', maxWordsPerGroup: 4, devanagariFont: 'Rozha One' }),
  fresh('noir', 'Noir', 'luxury', ['cream', 'serif', 'film'], 'Rozha One', 400, { color: '#F3E9D7', animation: 'fade', maxWordsPerGroup: 5 }),
  fresh('desi-pop', 'Desi Pop', 'hindi', ['amber', 'pop', 'cheerful'], 'Baloo 2', 700, { hl: '#FFB800', animation: 'pop', maxWordsPerGroup: 3 }),
  fresh('bollywood-marquee', 'Bollywood Marquee', 'hindi', ['pink', 'serif', 'filmy'], 'Rozha One', 400, { hl: '#FF5DA2', animation: 'fade', maxWordsPerGroup: 3, stroke: stroke(3) }),
  fresh('hindi-bold-box', 'Hindi Bold Box', 'hindi', ['box', 'magenta', 'white'], 'Poppins', 700, { hl: '#FFFFFF', animation: 'pop', maxWordsPerGroup: 3, background: box('#C2185B', .95) }),
  fresh('tez-karaoke', 'Tez Karaoke', 'hindi', ['karaoke', 'yellow', 'fast'], 'Poppins', 700, { hl: '#FFD60A', animation: 'karaoke', maxWordsPerGroup: 4 }),
  fresh('saaf', 'Saaf', 'hindi', ['clean', 'light', 'fade'], 'Poppins', 400, { animation: 'fade', maxWordsPerGroup: 5, stroke: stroke(2) }),
  fresh('dhamaka', 'Dhamaka', 'hindi', ['orange', 'neon', 'bounce'], 'Teko', 700, { hl: '#FF6B00', animation: 'bounce', wordEffect: 'neon', maxWordsPerGroup: 2 }),
]);
export function templateStyle(id: string, height: number): CaptionStyle {
  const template = CAPTION_TEMPLATES.find(t => t.id === id);
  if (!template) throw new Error('Unknown caption template.');
  const optical = BUNDLED_FONTS[template.style.font as BundledFont]?.opticalScale ?? 1;
  const size = height * .055 * (template.category === 'hindi' ? 1.25 : 1) * optical;
  return { ...structuredClone(template.style), fontSize: Math.min(160, Math.max(16, Math.round(size))), yOffset: Math.min(2000, Math.round(height * .15)) };
}
export function parseCustomTemplate(value: unknown): CaptionTemplate {
  const t = value as CaptionTemplate;
  if (!t || typeof t.name !== 'string' || !t.name.trim() || t.name.length > 40) throw new Error('Template name must be 1–40 characters.');
  validateDocument({ captions: [], style: t.style }, 0);
  return { id: 'custom-' + globalThis.crypto.randomUUID(), name: t.name.trim(), description: 'Saved in this browser', category: 'minimal', tags: ['custom', 'saved'], style: structuredClone(t.style) };
}
