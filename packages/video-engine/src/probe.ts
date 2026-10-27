/**
 * Probe video metadata and extract thumbnails via ffprobe/ffmpeg.
 */

import { stat } from 'node:fs/promises';
import path from 'node:path';
import type { Env, VideoMetadata } from '@clipx/types';
import { runFfmpeg, runFfprobe } from './ffmpeg';

interface FfprobeJson {
  format?: { duration?: string; bit_rate?: string; format_name?: string };
  streams?: Array<{
    codec_type?: string;
    codec_name?: string;
    width?: number;
    height?: number;
    r_frame_rate?: string;
    avg_frame_rate?: string;
  }>;
}

/** Probe a local video file and return normalized metadata. */
export async function probeVideo(
  env: Env,
  filePath: string,
): Promise<VideoMetadata> {
  const { stdout } = await runFfprobe(env, [
    '-v', 'error',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    filePath,
  ]);
  const data: FfprobeJson = JSON.parse(stdout);
  const videoStream = data.streams?.find((s) => s.codec_type === 'video');
  const audioStream = data.streams?.find((s) => s.codec_type === 'audio');

  const duration = parseFloat(data.format?.duration ?? '0') || 0;
  const fps = parseFrameRate(
    videoStream?.avg_frame_rate || videoStream?.r_frame_rate,
  );

  const sizeBytes = (await stat(filePath)).size;

  return {
    duration,
    width: videoStream?.width ?? 0,
    height: videoStream?.height ?? 0,
    fps,
    codec: videoStream?.codec_name ?? 'unknown',
    audioCodec: audioStream?.codec_name ?? null,
    bitrate: data.format?.bit_rate ? parseInt(data.format.bit_rate, 10) : undefined,
    sizeBytes,
    container: path.extname(filePath).slice(1).toLowerCase() || (data.format?.format_name ?? 'unknown'),
  };
}

/** Create a small poster frame without changing the source video's proportions. */
export async function extractThumbnail(env: Env, source: string, output: string, duration: number): Promise<void> {
  await runFfmpeg(env, { args: [
    '-y', '-ss', String(Math.min(3, Math.max(0, duration / 10))), '-i', source,
    '-frames:v', '1', '-vf', 'scale=640:360:force_original_aspect_ratio=decrease', '-q:v', '4', output,
  ] });
}

function parseFrameRate(r: string | undefined): number {
  if (!r) return 0;
  const [a, b] = r.split('/').map(Number);
  if (!a || !b) return 0;
  const v = a / b;
  return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0;
}
