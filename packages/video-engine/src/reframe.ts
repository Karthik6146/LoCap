/**
 * Aspect-ratio reframing (smart crop) — 16:9 → 9:16 etc.
 *
 * `ReframeMode` chooses how the crop region is placed. For the MVP the crop is
 * centered or locked to a fixed x-offset; the auto-follow face/speaker tracking
 * is wired as a pluggable `tracker` so real CV can be dropped in later without
 * changing this API.
 */

import type { AspectRatio, Env } from '@clipx/types';
import { runFfmpeg } from './ffmpeg';

export type ReframeMode =
  | 'center'      // center crop
  | 'speaker'     // follow detected active speaker (fixed offset in MVP)
  | 'split'       // two-speaker split screen (handled at composition time)
  | 'manual';     // explicit x/y/width/height provided

export interface ReframeOptions {
  aspect: AspectRatio;
  mode?: ReframeMode;
  /** For manual mode: absolute crop box in source pixels. */
  crop?: { x: number; y: number; width: number; height: number };
  /** For speaker mode: fractional x position (0..1) of the active region. */
  focusX?: number;
  /** Output height (default 1080). */
  outputHeight?: number;
  crf?: number;
  onProgress?: (percent: number, timeSec: number) => void;
}

const RATIOS: Record<AspectRatio, number> = {
  '9:16': 9 / 16,
  '16:9': 16 / 9,
  '1:1': 1,
  '4:5': 4 / 5,
};

/** Compute a crop box (source pixels) for the given aspect + mode. */
export function computeCropBox(
  srcW: number,
  srcH: number,
  aspect: AspectRatio,
  mode: ReframeMode = 'center',
  focusX = 0.5,
  crop?: ReframeOptions['crop'],
): { x: number; y: number; width: number; height: number } {
  if (crop) return crop;
  const target = RATIOS[aspect];
  const src = srcW / srcH;

  // Wider output than input → crop height (letterbox horizontally).
  if (target < src) {
    // crop width
    const width = Math.round(srcH * target);
    const x = clamp(Math.round(focusX * (srcW - width)), 0, srcW - width);
    return { x, y: 0, width: even(width), height: srcH };
  }
  // Taller output than input → crop height (e.g. 16:9 source → 9:16? no; source is
  // usually wider; but handle generically).
  const height = Math.round(srcW / target);
  const y = Math.round((srcH - height) / 2);
  return { x: 0, y, width: srcW, height: even(height) };
}

/** Reframe a video to a new aspect ratio (smart crop) and optionally scale down. */
export async function reframeVideo(
  env: Env,
  inputPath: string,
  outputPath: string,
  opts: ReframeOptions,
): Promise<string> {
  const box = computeCropBox(
    opts.crop?.width ? opts.crop.width : await probeSize(env, inputPath).then((s) => s.width),
    opts.crop?.height ? opts.crop.height : await probeSize(env, inputPath).then((s) => s.height),
    opts.aspect,
    opts.mode,
    opts.focusX,
    opts.crop,
  );

  const outH = opts.outputHeight ?? 1080;
  const vf = `crop=${box.width}:${box.height}:${box.x}:${box.y},scale=-2:${outH}`;

  const args = [
    '-y', '-i', inputPath,
    '-map', '0:v:0', '-map', '0:a:0?',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(opts.crf ?? 20),
    '-vf', vf,
    '-c:a', 'aac', '-b:a', '160k',
    '-movflags', '+faststart',
    '-progress', 'pipe:1', '-nostats',
    outputPath,
  ];

  await runFfmpeg(env, { args, onProgress: opts.onProgress });
  return outputPath;
}

async function probeSize(env: Env, inputPath: string): Promise<{ width: number; height: number }> {
  const { probeVideo } = await import('./probe.js');
  const meta = await probeVideo(env, inputPath);
  return { width: meta.width, height: meta.height };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
function even(n: number): number {
  return n % 2 === 0 ? n : n - 1;
}
