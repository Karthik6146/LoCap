import { loadEnv } from '@clipx/types';

/** Test env with FFmpeg pointed at the system binaries. */
export const testEnv = loadEnv({
  ...process.env,
  NODE_ENV: 'test',
  FFMPEG_PATH: process.env.FFMPEG_PATH || 'ffmpeg',
  FFPROBE_PATH: process.env.FFPROBE_PATH || 'ffprobe',
});

/** Create a temp working dir per test. */
export async function tmpDir(prefix: string): Promise<string> {
  const { mkdtemp } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = await mkdtemp(join(tmpdir(), `clipx-${prefix}-`));
  return dir;
}
