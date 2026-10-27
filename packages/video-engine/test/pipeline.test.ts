import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { join } from 'node:path';
import { readFile, rm } from 'node:fs/promises';
import {
  generateTestVideo,
  probeVideo,
  extractThumbnail,
  cutClip,
  reframeVideo,
  burnCaptions,
  extractAudio,
  preprocessSpeechAudio,
} from '../src/index.js';
import { testEnv, tmpDir } from './helpers.js';

let dir: string;
let source: string;

beforeAll(async () => {
  dir = await tmpDir('pipeline');
  source = join(dir, 'source.mp4');
  await generateTestVideo(testEnv, { outFile: source, duration: 12 });
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('video-engine pipeline', () => {
  it.each([[640, 360], [360, 640], [360, 360]])('creates a small poster from a short %sx%s video without stretching it', async (width, height) => {
    const short = join(dir, `short-${width}-${height}.mp4`);
    const poster = join(dir, `poster-${width}-${height}.jpg`);
    await generateTestVideo(testEnv, { outFile: short, width, height, duration: .4 });
    await extractThumbnail(testEnv, short, poster, .4);
    const bytes = await readFile(poster), metadata = await probeVideo(testEnv, poster);
    expect(bytes.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
    expect(bytes.length).toBeLessThan(100_000);
    expect(metadata.width).toBeLessThanOrEqual(640);
    expect(metadata.height).toBeLessThanOrEqual(360);
    expect(Math.abs(metadata.width / metadata.height - width / height)).toBeLessThan(.01);
  });
  it('cleans speech audio without changing duration and keeps 16kHz mono PCM', async () => {
    const raw = join(dir, 'raw.wav'), clean = join(dir, 'clean.wav');
    await extractAudio(testEnv, source, raw);
    await preprocessSpeechAudio(testEnv, raw, clean);
    const before = await probeVideo(testEnv, raw), after = await probeVideo(testEnv, clean);
    expect(Math.abs(after.duration - before.duration)).toBeLessThan(.025);
    expect(after.audioCodec).toBe('pcm_s16le');
  });
  it('generates and probes a test video', async () => {
    const meta = await probeVideo(testEnv, source);
    expect(meta.duration).toBeGreaterThanOrEqual(11);
    expect(meta.duration).toBeLessThanOrEqual(13);
    expect(meta.width).toBe(640);
    expect(meta.height).toBe(360);
    expect(meta.codec).toBe('h264');
    expect(meta.sizeBytes).toBeGreaterThan(0);
  });

  it('cuts a non-destructive clip segment', async () => {
    const clip = join(dir, 'clip.mp4');
    await cutClip(testEnv, source, 1, 5, clip, { maxHeight: 360, fps: 30 });
    const meta = await probeVideo(testEnv, clip);
    expect(meta.duration).toBeGreaterThanOrEqual(3.5);
    expect(meta.duration).toBeLessThanOrEqual(4.5);
    expect(meta.codec).toBe('h264');
  });

  it('reframes 16:9 source to vertical 9:16', async () => {
    const vertical = join(dir, 'vertical.mp4');
    await reframeVideo(testEnv, source, vertical, { aspect: '9:16', outputHeight: 1080 });
    const meta = await probeVideo(testEnv, vertical);
    // 9:16 → width < height.
    expect(meta.width).toBeLessThan(meta.height);
    expect(meta.width).toBe(606);
    expect(meta.height).toBe(1080);
  });

  it('burns styled captions onto a clip', async () => {
    const vertical = join(dir, 'vertical.mp4');
    const captioned = join(dir, 'captioned.mp4');
    const style = {
      id: 's1',
      name: 'Test Bold',
      category: 'bold' as const,
      font: 'Arial',
      fontWeight: 800,
      fontSize: 64,
      color: '#ffffff',
      highlightColor: '#ffd400',
      stroke: { width: 3, color: '#000000' },
      shadow: { blur: 0, color: '#000000', offsetX: 0, offsetY: 2 },
      background: { enabled: false, color: '#000000', opacity: 0.5, radius: 8 },
      animation: 'word-by-word' as const,
      position: 'bottom' as const,
      yOffset: 120,
      wordSpacing: 1,
      lineSpacing: 1.2,
      maxWordsPerGroup: 5,
      highlight: { enabled: true, activeColor: '#ffd400', activeScale: 1.2, activeBold: true },
      builtin: false,
    };
    await burnCaptions(
      testEnv,
      vertical,
      captioned,
      {
        groups: [
          {
            start: 0,
            end: 2,
            words: [
              { text: 'Bro', start: 0, end: 0.6 },
              { text: 'REALLY', start: 0.6, end: 1.2, highlight: true },
              { text: 'won', start: 1.2, end: 1.6 },
              { text: 'this', start: 1.6, end: 2 },
            ],
          },
        ],
        style,
        width: 606,
        height: 1080,
      },
    );
    const meta = await probeVideo(testEnv, captioned);
    expect(meta.codec).toBe('h264');
    expect(meta.width).toBe(606);
    expect(meta.duration).toBeGreaterThan(0);
  });
});
