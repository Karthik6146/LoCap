import { afterEach, expect, it, vi } from 'vitest';
import type { Transcript } from '@clipx/types';
import { loadEnv } from '@clipx/types';
import { convertTranscriptToHinglish } from '../src/ollama-hinglish';

afterEach(() => vi.unstubAllGlobals());

it('never passes Urdu or another unsupported script through as Hinglish', async () => {
  for (const text of ['\u06c1\u0644\u0648', '\u4f60\u597d']) {
    const source: Transcript = { language: 'hi', script: 'mixed', duration: 1, confidence: .8, silences: [], sentences: [],
      words: [{ id: 'a', text, start: .1, end: .9, confidence: .8 }] };
    await expect(convertTranscriptToHinglish(source)).rejects.toThrow('outside Hindi/English');
    await expect(convertTranscriptToHinglish(source, { baseUrl: 'http://localhost:11434', model: 'qwen3.5:9b' })).rejects.toThrow('outside Hindi/English');
  }
});

it.each([{ w0: 'आज' }, { w0: '' }, { w1: 'aaj' }, { w0: 'aaj', extra: 'hum' }])('rejects unsafe output rather than silently switching to rules: %j', async mapping => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: { content: JSON.stringify(mapping) } }))));
  const source: Transcript = { language: 'hi', script: 'hi', duration: 1, confidence: .8, silences: [], sentences: [],
    words: [{ id: 'a', text: 'आज', start: .1, end: .9, confidence: .8 }] };
  await expect(convertTranscriptToHinglish(source, { baseUrl: 'http://localhost:11434', model: 'qwen3.5:9b' })).rejects.toThrow('Qwen added');
});

it('restores punctuation exactly once and resolves keys independently of response order', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: { content: '{"w1":"hum","w0":"aaj"}' } }))));
  const source: Transcript = { language: 'hi', script: 'hi', duration: 2, confidence: .8, silences: [], sentences: [],
    words: [{ id: 'a', text: '“आज,”', start: .1, end: .9, confidence: .8 }, { id: 'b', text: 'हम।', start: 1, end: 2, confidence: .8 }] };
  const result = await convertTranscriptToHinglish(source, { baseUrl: 'http://localhost:11434', model: 'qwen3.5:9b' });
  expect(result.words.map(w => w.text)).toEqual(['“aaj,”', 'hum.']);
  expect(result.words.map(w => [w.id, w.start, w.end])).toEqual(source.words.map(w => [w.id, w.start, w.end]));
});

it('selects the configured local Qwen model from environment settings', () => {
  expect(loadEnv({ AI_PROVIDER: 'ollama' }).ollama).toEqual({
    baseUrl: 'http://127.0.0.1:11434',
    model: 'qwen3.5:9b',
  });
});

it('uses the configured local Qwen model and preserves English, IDs, and word timings', async () => {
  const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    expect(String(_url)).toBe('http://127.0.0.1:11434/api/chat');
    expect(body.model).toBe('qwen3.5:9b');
    expect(body.think).toBe(false);
    expect(body.format.required).toEqual(['w0', 'w1']);
    expect(body.options.presence_penalty).toBe(0);
    return new Response(JSON.stringify({ message: { content: JSON.stringify({ w0: 'aaj', w1: 'hum' }) } }), { status: 200 });
  });
  vi.stubGlobal('fetch', fetchMock);

  const source: Transcript = {
    language: 'hi', script: 'hi', duration: 3, confidence: .9, silences: [],
    words: [
      { id: '1', text: 'आज', start: .1, end: .4, confidence: .9 },
      { id: '2', text: 'हम', start: .5, end: .8, confidence: .9 },
      { id: '3', text: 'video', start: .9, end: 1.2, confidence: .9 },
      { id: '4', text: 'editing', start: 1.3, end: 1.8, confidence: .9 },
    ],
    sentences: [{ id: 's1', text: 'आज हम video editing', start: .1, end: 1.8, wordIds: ['1', '2', '3', '4'], confidence: .9 }],
  };

  const result = await convertTranscriptToHinglish(source, {
    baseUrl: 'http://127.0.0.1:11434/', model: 'qwen3.5:9b',
  });

  expect(result.script).toBe('hi-latn');
  expect(result.words.map(({ text }) => text)).toEqual(['aaj', 'hum', 'video', 'editing']);
  expect(result.words.map(({ id, start, end }) => ({ id, start, end }))).toEqual(
    source.words.map(({ id, start, end }) => ({ id, start, end })),
  );
  expect(result.sentences[0]?.text).toBe('aaj hum video editing');
  expect(source.words[0]?.text).toBe('आज');
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('uses the existing offline transliterator only when Ollama is not selected', async () => {
  const source: Transcript = {
    language: 'hi', script: 'hi', duration: 1, confidence: .9, silences: [],
    words: [{ id: '1', text: 'आज', start: .1, end: .8, confidence: .9 }],
    sentences: [],
  };
  const result = await convertTranscriptToHinglish(source);
  expect(result.words[0]?.text).toBe('aaj');
});

it('rejects invented extra words without fabricating timestamps', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(
    JSON.stringify({ message: { content: JSON.stringify({ w0: 'aaj hum' }) } }),
    { status: 200 },
  )));
  const source: Transcript = {
    language: 'hi', script: 'hi', duration: 1, confidence: .9, silences: [],
    words: [{ id: '1', text: 'आज', start: .1, end: .8, confidence: .9 }],
    sentences: [],
  };
  await expect(convertTranscriptToHinglish(source, {
    baseUrl: 'http://127.0.0.1:11434', model: 'qwen3.5:9b',
  })).rejects.toThrow('Qwen added');
});

it('rejects mappings with a different item count', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(
    JSON.stringify({ message: { content: JSON.stringify({ words: [] }) } }),
    { status: 200 },
  )));
  const source: Transcript = {
    language: 'hi', script: 'hi', duration: 1, confidence: .9, silences: [],
    words: [{ id: '1', text: 'आज', start: .1, end: .8, confidence: .9 }],
    sentences: [],
  };
  await expect(convertTranscriptToHinglish(source, {
    baseUrl: 'http://127.0.0.1:11434', model: 'qwen3.5:9b',
  })).rejects.toThrow('Qwen added');
});
