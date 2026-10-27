/**
 * Audio extraction — 16 kHz mono WAV, the standard input shape for Whisper-style
 * transcription. Optionally slices a time range for segment-level transcription.
 */

import type { Env } from '@clipx/types';
import { runFfmpeg } from './ffmpeg';

/** Mild spectral denoising + loudness normalization; never time-stretch/trim. */
export async function preprocessSpeechAudio(env: Env, input: string, output: string): Promise<string> {
  await runFfmpeg(env, { args: ['-y', '-i', input, '-vn', '-af',
    'highpass=f=70,afftdn=nr=8:nf=-35,loudnorm=I=-20:TP=-2:LRA=11',
    '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', output] });
  return output;
}

export interface ExtractAudioOptions {
  start?: number;
  end?: number;
  /** Whether the source video is known to have audio. If false, generates silent WAV. */
  hasAudio?: boolean;
}

/** Extract (or slice) audio to a 16 kHz mono WAV file. If hasAudio=false, generates silence. */
export async function extractAudio(
  env: Env,
  videoPath: string,
  outWavPath: string,
  opts: ExtractAudioOptions = {},
): Promise<string> {
  const { start, end, hasAudio = true } = opts;
  const args: string[] = ['-y'];
  if (start != null) args.push('-ss', String(start));
  args.push('-i', videoPath);
  if (end != null) args.push('-to', String(end));

  if (hasAudio) {
    args.push(
      '-vn',
      '-ac', '1',
      '-ar', '16000',
      '-c:a', 'pcm_s16le',
      outWavPath,
    );
    await runFfmpeg(env, { args });
  } else {
    // No audio in source — generate silent WAV of the same duration.
    const duration = (end ?? 0) - (start ?? 0);
    args.length = 0; // reset
    args.push(
      '-f', 'lavfi',
      '-i', `anullsrc=r=16000:cl=mono:d=${duration}`,
      '-ac', '1',
      '-ar', '16000',
      '-c:a', 'pcm_s16le',
      '-t', String(duration),
      outWavPath,
    );
    await runFfmpeg(env, { args });
  }
  return outWavPath;
}
