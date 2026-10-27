/**
 * Low-level FFmpeg / FFprobe runner built on the installed binaries.
 * Uses `-progress pipe:1` so callers receive real, non-faked progress.
 */

import { spawn } from 'node:child_process';
import type { Env } from '@clipx/types';

export interface RunOptions {
  /** Full ffmpeg argument vector (without the binary itself). */
  args: string[];
  /** Total duration in seconds — used to compute 0..100 progress. */
  duration?: number;
  onProgress?: (percent: number, timeSec: number) => void;
  env?: Env;
  /** Stderr stream is kept for diagnostics; progress parsed from stdout. */
}

export interface RunResult {
  stdout: string;
  stderr: string;
  durationSec: number;
}

export class FfmpegError extends Error {
  constructor(
    message: string,
    public readonly stderr: string,
    public readonly exitCode: number | null,
  ) {
    super(message);
    this.name = 'FfmpegError';
  }
}

function binaryPath(env: Env, kind: 'ffmpeg' | 'ffprobe'): string {
  return kind === 'ffmpeg' ? env.ffmpeg.path : env.ffmpeg.probePath;
}

/** Run ffprobe and return raw stdout text. */
export function runFfprobe(
  env: Env,
  args: string[],
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(binaryPath(env, 'ffprobe'), args, { windowsHide: true });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => (stdout += d.toString()));
    proc.stderr.on('data', (d) => (stderr += d.toString()));
    proc.on('error', (err: NodeJS.ErrnoException) => reject(new Error(err.code === 'ENOENT' ? 'ffprobe is not installed or FFPROBE_PATH is incorrect. Configure the worker and retry.' : err.message)));
    proc.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new FfmpegError(summarizeError(stderr), stderr, code));
    });
  });
}

/**
 * Run ffmpeg, parsing real progress from `-progress pipe:1`.
 * Pass `-progress pipe:1 -nostats` in args to enable progress reporting.
 */
export function runFfmpeg(env: Env, opts: RunOptions): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn(binaryPath(env, 'ffmpeg'), opts.args, { windowsHide: true });
    let stdout = '';
    let stderr = '';
    let durationMs = 0;

    const handleOut = (chunk: Buffer) => {
      stdout += chunk.toString();
      // Parse progress key=value lines.
      const text = chunk.toString();
      const msMatch = text.match(/out_time_ms=(\d+)/);
      const usMatch = text.match(/out_time_us=(\d+)/);
      const timeMatch = text.match(/out_time=([\d:.]+)/);
      let sec: number | null = null;
      if (msMatch) sec = Number(msMatch[1]) / 1e6;
      else if (usMatch) sec = Number(usMatch[1]) / 1e6;
      else if (timeMatch) sec = parseTime(timeMatch[1]!);
      if (sec != null) {
        durationMs = sec * 1000;
        if (opts.duration && opts.duration > 0) {
          const pct = Math.min(100, Math.round((sec / opts.duration) * 100));
          opts.onProgress?.(pct, sec);
        }
      }
    };

    proc.stdout.on('data', handleOut);
    proc.stderr.on('data', (d) => (stderr += d.toString()));
    proc.on('error', (err) => reject(err));
    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr, durationSec: durationMs / 1000 });
      } else {
        reject(
          new FfmpegError(
            summarizeError(stderr),
            stderr,
            code,
          ),
        );
      }
    });
  });
}

function parseTime(t: string): number | null {
  // hh:mm:ss.micro or mm:ss.micro
  const parts = t.split(':').map(Number);
  if (parts.length === 3) return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
  if (parts.length === 2) return parts[0]! * 60 + parts[1]!;
  return null;
}

/** Produce a short, user-safe error message from ffmpeg stderr. */
export function summarizeError(stderr: string): string {
  const lines = stderr.split('\n').filter(Boolean);
  const tail = lines.slice(-6).join(' ');
  // Common recognizable failures → friendly messages.
  if (/No such file or directory/.test(stderr)) {
    return 'Source video file not found.';
  }
  if (/Invalid data found when processing input/.test(stderr)) {
    return 'Video format not supported or the file is corrupted.';
  }
  if (/Unknown encoder/.test(stderr)) {
    return 'Required encoder is not available in this FFmpeg build.';
  }
  if (/Permission denied/.test(stderr)) {
    return 'Could not write output file (permission denied).';
  }
  return tail.trim().slice(0, 300) || 'FFmpeg processing failed.';
}

/** Spawn with maxBuffer raised for large ffprobe JSON. */
export const FFPROBE_TIMEOUT_MS = 30_000;
