/**
 * Non-destructive clip cutting. The source is never modified; a new segment
 * file is produced from the source media. Fast seek + re-encode for accuracy.
 */

import type { Env } from '@clipx/types';
import { runFfmpeg } from './ffmpeg';

export interface CutOptions {
  /** Target vertical resolution for a proxy (e.g. 720). 0 = keep source height. */
  maxHeight?: number;
  /** Target fps (0 = keep source fps). */
  fps?: number;
  crf?: number;
  preset?: string;
  onProgress?: (percent: number, timeSec: number) => void;
}

/** Cut a segment [start, end] (seconds) from a source into an output MP4. */
export async function cutClip(
  env: Env,
  inputPath: string,
  start: number,
  end: number,
  outputPath: string,
  opts: CutOptions = {},
): Promise<string> {
  const duration = Math.max(0, end - start);
  const args: string[] = ['-y'];
  // Fast seek (before input) + re-encode for accurate frame cuts.
  args.push('-ss', String(start), '-i', inputPath, '-t', String(duration));
  args.push('-map', '0:v:0', '-map', '0:a:0?');
  args.push('-c:v', 'libx264', '-preset', opts.preset ?? 'veryfast', '-crf', String(opts.crf ?? 20));
  if (opts.maxHeight && opts.maxHeight > 0) {
    // Scale down proportionally, ensure even dimensions for H.264.
    args.push('-vf', `scale=-2:'min(${opts.maxHeight},ih)'`);
  }
  if (opts.fps && opts.fps > 0) args.push('-r', String(opts.fps));
  args.push('-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart');
  args.push('-progress', 'pipe:1', '-nostats', outputPath);

  await runFfmpeg(env, {
    args,
    duration,
    onProgress: opts.onProgress,
  });
  return outputPath;
}
