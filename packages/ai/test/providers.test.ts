import { describe, it, expect } from 'vitest';
import { DevTranscriptionProvider, DevLLMProvider, suggestEmojis, convertLineScript, getTranscriptionProvider } from '../src/index.js';
import { loadEnv } from '@clipx/types';

it('never substitutes synthetic captions for unconfigured user uploads', () => {
  expect(() => getTranscriptionProvider(loadEnv({ NODE_ENV: 'development' }))).toThrow('TRANSCRIPTION_API_KEY');
  expect(() => getTranscriptionProvider(loadEnv({ NODE_ENV: 'production' }))).toThrow('TRANSCRIPTION_API_KEY');
  expect(getTranscriptionProvider(loadEnv({ NODE_ENV: 'production', TRANSCRIPTION_API_KEY: 'test-key' })).name).toBe('whisper');
});

describe('DevTranscriptionProvider', () => {
  const p = new DevTranscriptionProvider();

  it('produces well-formed word + sentence timestamps', async () => {
    const t = await p.transcribe('/tmp/fake.wav', { audioDuration: 30 });
    expect(t.words.length).toBeGreaterThan(0);
    expect(t.sentences.length).toBeGreaterThan(0);
    // words sorted & contiguous
    for (let i = 1; i < t.words.length; i++) {
      expect(t.words[i]!.start).toBeGreaterThanOrEqual(t.words[i - 1]!.end);
    }
    // confidence in [0,1]
    for (const w of t.words) {
      expect(w.confidence).toBeGreaterThanOrEqual(0);
      expect(w.confidence).toBeLessThanOrEqual(1);
      expect(w.end).toBeGreaterThan(w.start);
    }
    expect(t.duration).toBe(30);
  });

  it('flags filler words', async () => {
    const t = await p.transcribe('/tmp/fake.wav', { audioDuration: 20 });
    expect(t.words.some((w) => w.isFiller)).toBe(true);
  });

  it('lays words out within the audio duration', async () => {
    const t = await p.transcribe('/tmp/fake.wav', { audioDuration: 5 });
    expect(t.words[t.words.length - 1]!.end).toBeLessThanOrEqual(5.001);
  });
});

describe('DevLLMProvider', () => {
  const p = new DevLLMProvider();

  it('returns ranked clip suggestions with scores', async () => {
    const t = await new DevTranscriptionProvider().transcribe('/tmp/fake.wav', { audioDuration: 60 });
    const clips = await p.analyzeTranscript(t, { count: 5, clipLength: 20 });
    expect(clips.length).toBeGreaterThan(0);
    for (const c of clips) {
      expect(c.scores.overall).toBeGreaterThanOrEqual(0);
      expect(c.scores.overall).toBeLessThanOrEqual(100);
      expect(c.end).toBeGreaterThan(c.start);
      expect(typeof c.title).toBe('string');
    }
    // sorted best-first
    for (let i = 1; i < clips.length; i++) {
      expect(clips[i - 1]!.scores.overall).toBeGreaterThanOrEqual(clips[i]!.scores.overall);
    }
  });

  it('generates hooks and emojis', async () => {
    const hooks = await p.generateHooks('Bro REALLY won this clutch', 5);
    expect(hooks.length).toBe(5);
    const emojis = suggestEmojis('That was an insane clutch', 3);
    expect(emojis.length).toBeGreaterThan(0);
  });

  it('switches caption script without changing timing', () => {
    const converted = convertLineScript(['aaj', 'hum', 'dekhenge'], 'hi');
    expect(converted).toEqual(['आज', 'हम', 'dekhenge']);
  });
});
