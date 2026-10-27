/**
 * Original caption style presets (spec section 16) — 30+ templates across all
 * categories. These are original designs; not copied from any other app.
 */

import type { CaptionAnimation, CaptionStyle } from '@clipx/types';

interface StyleSpec {
  name: string;
  category: CaptionStyle['category'];
  font: string;
  weight: number;
  size: number;
  color: string;
  highlight: string;
  stroke: { width: number; color: string };
  shadow?: { blur: number; color: string; offsetX: number; offsetY: number };
  bg?: { enabled: boolean; color: string; opacity: number; radius: number };
  animation: CaptionAnimation;
  position: CaptionStyle['position'];
  yOffset: number;
  maxWords: number;
  highlightScale: number;
}

const base = (s: StyleSpec): CaptionStyle => ({
  id: slug(s.name),
  name: s.name,
  category: s.category,
  font: s.font,
  fontWeight: s.weight,
  fontSize: s.size,
  color: s.color,
  highlightColor: s.highlight,
  stroke: s.stroke,
  shadow: s.shadow ?? { blur: 0, color: '#000000', offsetX: 0, offsetY: 0 },
  background: s.bg ?? { enabled: false, color: '#000000', opacity: 0.5, radius: 8 },
  animation: s.animation,
  position: s.position,
  yOffset: s.yOffset,
  wordSpacing: 1,
  lineSpacing: 1.2,
  maxWordsPerGroup: s.maxWords,
  highlight: {
    enabled: true,
    activeColor: s.highlight,
    activeScale: s.highlightScale,
    activeBold: true,
  },
  builtin: true,
});

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

const W = 80; // default y offset for bottom captions

export const CAPTION_STYLES: CaptionStyle[] = [
  // Minimal
  base({ name: 'Clean White', category: 'minimal', font: 'Arial', weight: 600, size: 64, color: '#ffffff', highlight: '#ffffff', stroke: { width: 2, color: '#000000' }, shadow: { blur: 0, color: '#000000', offsetX: 0, offsetY: 2 }, animation: 'word-by-word', position: 'bottom', yOffset: W, maxWords: 4, highlightScale: 1.0 }),
  base({ name: 'Soft Pill', category: 'minimal', font: 'Segoe UI', weight: 600, size: 60, color: '#ffffff', highlight: '#ffffff', stroke: { width: 0, color: '#000000' }, shadow: { blur: 0, color: '#000000', offsetX: 0, offsetY: 1 }, bg: { enabled: true, color: '#000000', opacity: 0.55, radius: 12 }, animation: 'fade', position: 'bottom', yOffset: W, maxWords: 5, highlightScale: 1.0 }),
  base({ name: 'Minimal Ghost', category: 'minimal', font: 'Arial', weight: 400, size: 58, color: '#e6e6e6', highlight: '#ffffff', stroke: { width: 1, color: '#000000' }, animation: 'fade', position: 'bottom', yOffset: W, maxWords: 5, highlightScale: 1.05 }),
  // Bold
  base({ name: 'Impact Pop', category: 'bold', font: 'Arial Black', weight: 900, size: 88, color: '#ffffff', highlight: '#ffd400', stroke: { width: 4, color: '#000000' }, shadow: { blur: 0, color: '#000000', offsetX: 0, offsetY: 4 }, animation: 'pop', position: 'bottom', yOffset: W, maxWords: 3, highlightScale: 1.3 }),
  base({ name: 'Blockbuster', category: 'bold', font: 'Arial Black', weight: 900, size: 96, color: '#ffffff', highlight: '#ff3b3b', stroke: { width: 6, color: '#000000' }, shadow: { blur: 0, color: '#000000', offsetX: 0, offsetY: 5 }, animation: 'scale', position: 'center', yOffset: W, maxWords: 3, highlightScale: 1.4 }),
  base({ name: 'Thick Stroke', category: 'bold', font: 'Arial', weight: 800, size: 76, color: '#ffffff', highlight: '#00e5ff', stroke: { width: 8, color: '#111111' }, animation: 'word-by-word', position: 'bottom', yOffset: W, maxWords: 4, highlightScale: 1.2 }),
  base({ name: 'High Contrast', category: 'bold', font: 'Arial', weight: 900, size: 82, color: '#111111', highlight: '#ffd400', stroke: { width: 0, color: '#000000' }, bg: { enabled: true, color: '#ffffff', opacity: 1, radius: 4 }, animation: 'pop', position: 'bottom', yOffset: W, maxWords: 3, highlightScale: 1.2 }),
  // Gaming
  base({ name: 'Valorant Vibes', category: 'gaming', font: 'Arial Black', weight: 900, size: 84, color: '#ff4655', highlight: '#ffffff', stroke: { width: 3, color: '#000000' }, shadow: { blur: 0, color: '#000000', offsetX: 0, offsetY: 3 }, animation: 'shake', position: 'center', yOffset: W, maxWords: 3, highlightScale: 1.3 }),
  base({ name: 'Esports', category: 'gaming', font: 'Arial Black', weight: 900, size: 80, color: '#0aff9d', highlight: '#ffffff', stroke: { width: 3, color: '#0a0a0a' }, animation: 'zoom', position: 'bottom', yOffset: W, maxWords: 4, highlightScale: 1.25 }),
  base({ name: 'Neon Arcade', category: 'gaming', font: 'Impact', weight: 800, size: 84, color: '#f0f', highlight: '#0ff', stroke: { width: 3, color: '#000' }, shadow: { blur: 0, color: '#0ff', offsetX: 0, offsetY: 3 }, animation: 'wave', position: 'bottom', yOffset: W, maxWords: 4, highlightScale: 1.2 }),
  base({ name: 'Streamer Mode', category: 'gaming', font: 'Arial Black', weight: 900, size: 72, color: '#ffffff', highlight: '#ffcc00', stroke: { width: 4, color: '#000' }, animation: 'bounce', position: 'bottom', yOffset: W, maxWords: 5, highlightScale: 1.2 }),
  // Podcast
  base({ name: 'Podcast Clean', category: 'podcast', font: 'Arial', weight: 600, size: 62, color: '#ffffff', highlight: '#7c5cff', stroke: { width: 2, color: '#000000' }, animation: 'word-by-word', position: 'center', yOffset: W, maxWords: 5, highlightScale: 1.15 }),
  base({ name: 'Studio Mic', category: 'podcast', font: 'Segoe UI', weight: 700, size: 60, color: '#f5f5f5', highlight: '#00d4ff', stroke: { width: 2, color: '#000' }, bg: { enabled: true, color: '#000000', opacity: 0.5, radius: 10 }, animation: 'slide', position: 'bottom', yOffset: W, maxWords: 5, highlightScale: 1.15 }),
  // Karaoke
  base({ name: 'Karaoke Fill', category: 'karaoke', font: 'Arial Black', weight: 800, size: 72, color: '#888888', highlight: '#ffe600', stroke: { width: 2, color: '#000' }, animation: 'word-by-word', position: 'bottom', yOffset: W, maxWords: 3, highlightScale: 1.0 }),
  base({ name: 'Sing Along', category: 'karaoke', font: 'Arial', weight: 700, size: 68, color: '#cccccc', highlight: '#ff6b6b', stroke: { width: 2, color: '#000' }, animation: 'character-by-character', position: 'center', yOffset: W, maxWords: 4, highlightScale: 1.0 }),
  // News
  base({ name: 'Lower Third', category: 'news', font: 'Arial', weight: 700, size: 56, color: '#ffffff', highlight: '#00c3ff', stroke: { width: 2, color: '#000' }, animation: 'fade', position: 'bottom', yOffset: 40, maxWords: 6, highlightScale: 1.1 }),
  base({ name: 'Headline', category: 'news', font: 'Arial Black', weight: 900, size: 70, color: '#ffffff', highlight: '#ff3b3b', stroke: { width: 3, color: '#000' }, animation: 'slide', position: 'top', yOffset: 80, maxWords: 5, highlightScale: 1.2 }),
  // Educational
  base({ name: 'Scholar', category: 'educational', font: 'Georgia', weight: 600, size: 62, color: '#ffffff', highlight: '#4dd0e1', stroke: { width: 2, color: '#000' }, animation: 'word-by-word', position: 'center', yOffset: W, maxWords: 5, highlightScale: 1.15 }),
  base({ name: 'Textbook', category: 'educational', font: 'Cambria', weight: 600, size: 60, color: '#ffffff', highlight: '#b6ff00', stroke: { width: 2, color: '#000' }, bg: { enabled: true, color: '#000000', opacity: 0.5, radius: 6 }, animation: 'fade', position: 'bottom', yOffset: W, maxWords: 6, highlightScale: 1.1 }),
  // Comedy
  base({ name: 'Meme Pop', category: 'comedy', font: 'Impact', weight: 900, size: 96, color: '#ffffff', highlight: '#ffe600', stroke: { width: 4, color: '#000' }, animation: 'pop', position: 'center', yOffset: W, maxWords: 3, highlightScale: 1.5 }),
  base({ name: 'Shout', category: 'comedy', font: 'Impact', weight: 900, size: 110, color: '#ffffff', highlight: '#ff3b3b', stroke: { width: 5, color: '#000' }, animation: 'shake', position: 'center', yOffset: W, maxWords: 2, highlightScale: 1.6 }),
  base({ name: 'Chuckle', category: 'comedy', font: 'Arial', weight: 800, size: 70, color: '#ffffff', highlight: '#ff9f1c', stroke: { width: 3, color: '#000' }, animation: 'bounce', position: 'bottom', yOffset: W, maxWords: 4, highlightScale: 1.25 }),
  // Luxury
  base({ name: 'Gold Serif', category: 'luxury', font: 'Georgia', weight: 700, size: 64, color: '#f5e6b8', highlight: '#ffd700', stroke: { width: 1, color: '#1a1a1a' }, animation: 'fade', position: 'bottom', yOffset: W, maxWords: 5, highlightScale: 1.15 }),
  base({ name: 'Elegant', category: 'luxury', font: 'Times New Roman', weight: 600, size: 62, color: '#ffffff', highlight: '#e8c87a', stroke: { width: 2, color: '#000' }, animation: 'word-by-word', position: 'center', yOffset: W, maxWords: 5, highlightScale: 1.12 }),
  // Neon
  base({ name: 'Cyber Neon', category: 'neon', font: 'Arial Black', weight: 900, size: 78, color: '#0ff', highlight: '#f0f', stroke: { width: 0, color: '#000' }, shadow: { blur: 0, color: '#0ff', offsetX: 0, offsetY: 0 }, animation: 'blur-in', position: 'center', yOffset: W, maxWords: 4, highlightScale: 1.25 }),
  base({ name: 'Laser', category: 'neon', font: 'Impact', weight: 800, size: 82, color: '#39ff14', highlight: '#ff00ff', stroke: { width: 2, color: '#003300' }, animation: 'wave', position: 'bottom', yOffset: W, maxWords: 4, highlightScale: 1.2 }),
  base({ name: 'Vaporwave', category: 'neon', font: 'Arial Black', weight: 900, size: 76, color: '#ff71ce', highlight: '#01cdfe', stroke: { width: 2, color: '#000' }, animation: 'blur-in', position: 'center', yOffset: W, maxWords: 4, highlightScale: 1.2 }),
  // Meme
  base({ name: 'Classic Meme', category: 'meme', font: 'Impact', weight: 900, size: 70, color: '#ffffff', highlight: '#ffffff', stroke: { width: 3, color: '#000' }, animation: 'none', position: 'center', yOffset: W, maxWords: 3, highlightScale: 1.0 }),
  base({ name: 'Impact Caps', category: 'meme', font: 'Impact', weight: 900, size: 90, color: '#ffffff', highlight: '#ffe600', stroke: { width: 4, color: '#000' }, animation: 'zoom', position: 'center', yOffset: W, maxWords: 3, highlightScale: 1.3 }),
  // Professional
  base({ name: 'Corporate', category: 'professional', font: 'Segoe UI', weight: 600, size: 58, color: '#ffffff', highlight: '#0078d4', stroke: { width: 2, color: '#000' }, animation: 'fade', position: 'bottom', yOffset: W, maxWords: 6, highlightScale: 1.1 }),
  base({ name: 'LinkedIn', category: 'professional', font: 'Calibri', weight: 600, size: 58, color: '#ffffff', highlight: '#0a66c2', stroke: { width: 2, color: '#000' }, animation: 'word-by-word', position: 'bottom', yOffset: W, maxWords: 6, highlightScale: 1.12 }),
];

export const DEFAULT_CAPTION_STYLE = CAPTION_STYLES[0]!;
