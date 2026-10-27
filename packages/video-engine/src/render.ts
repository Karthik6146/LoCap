/**
 * Final export render — encodes a cut/reframed/captioned video to an MP4 at the
 * requested resolution, fps, bitrate and codec, with audio mixing.
 */

import type { ExportCodec, Env, ExportSettings } from '@clipx/types';
import { runFfmpeg } from './ffmpeg';

export interface RenderOptions {
  settings: ExportSettings;
  /** Optional background-music file path (mix + ducking). */
  musicPath?: string;
  /** Optional voiceover track. */
  voiceoverPath?: string;
  onProgress?: (percent: number, timeSec: number) => void;
}

const CODEC_VIDEO: Record<ExportCodec, string> = { h264: 'libx264', h265: 'libx265' };
const CODEC_EXT: Record<ExportCodec, string> = { h264: 'h264', h265: 'hevc' };
const QUALITY_CRF: Record<'low' | 'medium' | 'high', number> = { low: 26, medium: 21, high: 17 };

/** Render the final MP4 export. */
export async function renderExport(
  env: Env,
  inputPath: string,
  outputPath: string,
  opts: RenderOptions,
): Promise<string> {
  const { settings } = opts;
  const crf = QUALITY_CRF[settings.quality];

  // Build the audio filter graph: apply volume, mix music (with ducking) and voiceover.
  const audioGraph = buildAudioGraph(settings, opts);

  const args = [
    '-y', '-i', inputPath,
  ];
  if (opts.musicPath) args.push('-i', opts.musicPath);
  if (opts.voiceoverPath) args.push('-i', opts.voiceoverPath);

  args.push(
    '-map', '0:v:0',
    '-c:v', CODEC_VIDEO[settings.codec],
    '-preset', 'medium',
    '-crf', String(crf),
    '-tag:v', CODEC_EXT[settings.codec],
  );
  // Scale to target dimensions (only if different from source).
  args.push('-vf', `scale=${settings.width}:${settings.height}:force_original_aspect_ratio=decrease,pad=${settings.width}:${settings.height}:(ow-iw)/2:(oh-ih)/2`);
  if (settings.fps > 0) args.push('-r', String(settings.fps));

  if (audioGraph) {
    args.push('-filter_complex', audioGraph.graph);
    args.push('-map', audioGraph.mapLabel, '-c:a', 'aac', '-b:a', '192k');
  } else {
    args.push('-map', '0:a:0?', '-c:a', 'aac', '-b:a', '192k');
  }

  args.push('-movflags', '+faststart', '-progress', 'pipe:1', '-nostats', outputPath);

  await runFfmpeg(env, { args, onProgress: opts.onProgress });
  return outputPath;
}

function buildAudioGraph(
  settings: ExportSettings,
  opts: RenderOptions,
): { graph: string; mapLabel: string } | null {
  const parts: string[] = [];
  const vol = settings.audio.volume != null ? settings.audio.volume : 1;
  parts.push(`[0:a]volume=${vol}[main]`);

  let final = 'main';
  if (opts.musicPath) {
    const musicVol = settings.audio.musicVolume ?? 0.35;
    if (settings.audio.ducking) {
      // Duck music under speech: gate the music by the voice amplitude.
      parts.push(
        `[1:a]volume=${musicVol}[musraw]`,
        `[musraw]asplit=2[musa][musb]`,
        `[0:a]asplit=2[va][vb]`,
        `[vb]highpass=f=200,lowpass=f=4000,volume=4[sidemask]`,
        `[musb][sidemask]sidechaincompress=threshold=0.02:ratio=12:attack=20:release=300[duck]`,
        `[va][duck]amix=inputs=2:normalize=0:dropout_transition=0[ducked]`,
      );
      final = 'ducked';
    } else {
      parts.push(`[1:a]volume=${musicVol}[music]`, `[main][music]amix=inputs=2:normalize=0[amix]`);
      final = 'amix';
    }
  }

  if (opts.voiceoverPath) {
    parts.push(`[2:a]volume=1.0[vo]`, `[${final}][vo]amix=inputs=2:normalize=0[voiced]`);
    final = 'voiced';
  }

  return { graph: parts.join(';'), mapLabel: `[${final}]` };
}
