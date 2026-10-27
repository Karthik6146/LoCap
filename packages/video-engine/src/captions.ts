/**
 * Caption burn engine — renders styled, word-level captions into a video using
 * an ASS (Advanced SubStation Alpha) subtitle track rendered by FFmpeg/libass.
 *
 * Word-by-word highlight ("active word" pop) is produced by emitting one ASS
 * event per word, each showing the full group line with the current word styled
 * in the highlight color and the rest in the base color. This gives a clean,
 * karaoke-style animated caption without needing an overlay renderer.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { AspectRatio, BurnGroup, CaptionStyle, Env } from '@clipx/types';
import { assFontSize, captionPosition, fitCaptionStyle, presentationBoundaries, wordPresentation } from '@clipx/captions';
import { runFfmpeg } from './ffmpeg';
import { assertBundledFonts, fontsDirectory } from './fonts';

export interface BurnOptions {
  groups: BurnGroup[];
  style: CaptionStyle;
  /** Output dimensions — ASS PlayRes is set to these so font size = output px. */
  width: number;
  height: number;
  /** Render every word statically (no per-word highlight animation). */
  staticOnly?: boolean;
  onProgress?: (percent: number, timeSec: number) => void;
}

/** Convert #RRGGBB → ASS &H AABBGGRR. */
export function toAssColor(hex: string, alpha = 0): string {
  const h = hex.replace('#', '');
  const r = h.slice(0, 2);
  const g = h.slice(2, 4);
  const b = h.slice(4, 6);
  const a = Math.round(alpha).toString(16).padStart(2, '0');
  return `&H${a}${b}${g}${r}&`;
}

/** Escape ASS inline-override-unsafe characters. */
function assEscape(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\n/g, '\\N');
}

function ts(totalMs: number): string {
  const ms = Math.max(0, totalMs);
  const cs = Math.round(ms / 10);
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const s = Math.floor((cs % 6000) / 100);
  const c = cs % 100;
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(c)}`;
}

/**
 * Build an ASS document for the given caption groups. Pure — unit-testable.
 */
export function buildAss(
  groups: BurnGroup[],
  style: CaptionStyle,
  width: number,
  height: number,
  staticOnly = false,
): string {

  const alpha = Math.round((1 - (style.opacity ?? 1)) * 255);
  const bold = style.fontWeight >= 700 ? '{\\b1}' : '{\\b0}';
  const border = style.background.enabled || style.wordEffect === 'marker' ? 3 : 1;
  const outline = style.background.enabled ? style.background.color : style.stroke.color;
  const outlineAlpha = style.background.enabled ? Math.round((1-style.background.opacity * (style.opacity ?? 1))*255) : alpha;
  const { x, y, anchor } = captionPosition(style, width, height);
  const pos = `{\\an${anchor}\\pos(${x},${y})}`;
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${width}
PlayResY: ${height}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${assEscape(style.font)},${Math.round(style.fontSize)},${toAssColor(style.color,alpha)},${toAssColor(style.highlightColor,alpha)},${toAssColor(outline,outlineAlpha)},${toAssColor(style.shadow.color,alpha)},${style.fontWeight >= 700 ? -1 : 0},0,0,0,100,100,0,0,${border},${style.background.enabled ? 4 : style.stroke.width},${style.shadow.offsetY},${anchor},0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  const events: string[] = [];
  for (const g of groups) {
    if (!g.words.length) continue;
    const fitted = fitCaptionStyle(g, style, width);
    const boundaries = presentationBoundaries(g, fitted, staticOnly);
    for (let i = 0; i < boundaries.length - 1; i++) {
      const start = boundaries[i]!, end = boundaries[i + 1]!;
      if (Math.round(end * 100) <= Math.round(start * 100)) continue;
      const renderWords = (glowLayer = false) => g.words.map(w => {
        const state = wordPresentation(w, g, fitted, start, staticOnly);
        const opacity = Math.round((1 - (style.opacity ?? 1) * state.opacity) * 255).toString(16).padStart(2, '0');
        const borderOpacity = glowLayer ? (state.glow ? opacity : 'ff') : Math.round(255 - (255 - outlineAlpha) * state.opacity).toString(16).padStart(2, '0');
        const color = state.color;
        const borderWidth = glowLayer ? state.glow : style.wordEffect === 'marker' ? (state.marker ? 4 : 0) : style.background.enabled ? 4 : style.stroke.width / 2;
        const outlineColor = glowLayer || state.marker ? style.highlightColor : outline;
        const tags = `{\\fn${state.font}\\fs${assFontSize(state.font, fitted.fontSize * state.scale)}\\c${toAssColor(color)}\\1a&H${glowLayer ? 'ff' : opacity}&\\3a&H${borderOpacity}&\\4a&H${glowLayer ? 'ff' : opacity}&\\3c${toAssColor(outlineColor)}\\bord${borderWidth}\\pbo${-state.lift}\\blur${glowLayer ? state.glow : 0}}`;
        return tags + bold + assEscape(state.visible) + (state.hidden ? '{\\1a&HFF&\\3a&HFF&\\4a&HFF&}' + assEscape(state.hidden) + `{\\3a&H${outlineAlpha.toString(16).padStart(2, '0')}&\\4a&H${alpha.toString(16).padStart(2, '0')}&}` : '');
      }).join(' ');
      const glow = style.wordEffect === 'neon' && !staticOnly && (style.animationStrength ?? 1) > 0;
      if (glow) events.push(`Dialogue: 0,${ts(start*1000)},${ts(end*1000)},Default,,0,0,0,,${pos}${renderWords(true)}`);
      events.push(`Dialogue: ${glow ? 1 : 0},${ts(start*1000)},${ts(end*1000)},Default,,0,0,0,,${pos}${renderWords()}`);
    }
  }

  return header + events.join('\n') + '\n';
}

export interface BurnCaptionsOptions extends BurnOptions {
  audioVolume?: number;
}

/** Burn captions into a (already-reframed/cut) video, producing a new MP4. */
export async function burnCaptions(
  env: Env,
  inputPath: string,
  outputPath: string,
  opts: BurnOptions & { fontsDir?: string },
): Promise<string> {
  const fontsDir = opts.fontsDir ?? fontsDirectory();
  await assertBundledFonts(fontsDir);
  const dir = path.dirname(outputPath);
  await mkdir(dir, { recursive: true });
  const assPath = path.join(dir, 'captions.ass');
  const ass = buildAss(opts.groups, opts.style, opts.width, opts.height, opts.staticOnly);
  await writeFile(assPath, ass, 'utf8');

  // On Windows the ASS path must use forward slashes for the filter arg.
  const assFilter = assPath.replace(/\\/g, '/').replace(/:/g, '\\:');
  const fonts = fontsDir.replace(/\\/g, '/').replace(/:/g, '\\:');

  const args = [
    '-y', '-i', inputPath,
    '-map', '0:v:0', '-map', '0:a:0?',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
    '-vf', `ass='${assFilter}':fontsdir='${fonts}'`,
    '-c:a', 'aac', '-b:a', '160k',
    '-movflags', '+faststart',
    '-progress', 'pipe:1', '-nostats',
    outputPath,
  ];

  await runFfmpeg(env, { args, onProgress: opts.onProgress });
  return outputPath;
}

/** Placeholder aspect helper kept for interface completeness. */
export type { AspectRatio };
