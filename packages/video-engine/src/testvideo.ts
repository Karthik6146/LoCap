/**
 * Synthetic test-video generation (color bars + tone + spoken-style silence
 * gaps) used to verify the entire pipeline headlessly without real media.
 */

import type { Env } from '@clipx/types';
import { runFfmpeg } from './ffmpeg';

export interface TestVideoOptions {
  duration?: number;
  width?: number;
  height?: number;
  fps?: number;
  outFile?: string;
}

/**
 * Generate a deterministic test MP4: SMPTE color bars + a moving box + sine tone.
 * Default 16:9 640x360 30fps, 12 seconds.
 */
export async function generateTestVideo(
  env: Env,
  opts: TestVideoOptions = {},
): Promise<string> {
  const duration = opts.duration ?? 12;
  const width = opts.width ?? 640;
  const height = opts.height ?? 360;
  const fps = opts.fps ?? 30;
  const out = opts.outFile ?? `test-${Date.now()}.mp4`;

  const vf = `testsrc2=size=${width}x${height}:rate=${fps}:duration=${duration}`;

  const args = [
    '-y',
    '-f', 'lavfi',
    '-i', vf,
    '-f', 'lavfi',
    '-i', `sine=frequency=440:duration=${duration}`,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '128k',
    '-shortest',
    '-movflags', '+faststart',
    out,
  ];

  await runFfmpeg(env, { args, duration });
  return out;
}
