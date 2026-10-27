import { it, expect, vi, afterEach } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { WhisperProvider } from '../src/whisper';
afterEach(() => vi.unstubAllGlobals());
it('uploads actual audio bytes and reads top-level English/Hindi word timestamps', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'clipx-provider-'));
  const audio = path.join(dir, 'audio.wav');
  await writeFile(audio, 'RIFF-test-audio');
  try {
    const fetch = vi.fn(async (_url: string, init: RequestInit) => {
      const form = init.body as FormData;
      expect(await (form.get('file') as File).text()).toBe('RIFF-test-audio');
      expect(form.get('language')).toBe('hi');
      expect(form.get('prompt')).toBe('Minecraft, search bar');
      expect(form.get('timestamp_granularities[]')).toBe('word');
      return new Response(JSON.stringify({ language: 'hindi', duration: 2, words: [{ word: 'Hello', start: 0, end: .5 }, { word: 'नमस्ते', start: .6, end: 1.5 }] }));
    });
    vi.stubGlobal('fetch', fetch);
    const result = await new WhisperProvider({ apiKey: 'test', baseUrl: 'https://example.invalid', model: 'whisper-1' }).transcribe(audio, { language: 'hi', vocabulary: ['Minecraft', 'search bar'] });
    expect(result.words.map(w => w.text)).toEqual(['Hello', 'नमस्ते']);
    expect(result.words[1]!.start).toBe(.6);
    expect(result.script).toBe('mixed');
    expect(Number.isFinite(result.confidence)).toBe(true);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
