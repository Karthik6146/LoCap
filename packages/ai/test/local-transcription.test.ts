import { it, expect, vi } from 'vitest';
const exec = vi.hoisted(() => vi.fn());
vi.mock('node:child_process', () => ({ execFile: exec }));
import { LocalTranscriptionProvider } from '../src/local-transcription';

it('passes vocabulary to the local decoder and preserves real split-word times', async () => {
  exec.mockImplementationOnce((_python, args, _options, callback) => {
    expect(args).toContain('--vocabulary');
    expect(args).toContain(JSON.stringify(['search bar']));
    callback(null, JSON.stringify({ language: 'hi', duration: 1, words: [{ text: 'search', start: .1, end: .4, confidence: .8 }, { text: 'bar', start: .5, end: .8, confidence: .8 }] }), '');
  });
  const provider = new LocalTranscriptionProvider({ model: 'small', device: 'cpu', alignment: 'whisperx' });
  const transcript = await provider.transcribe('audio.wav', { language: 'hi-latn', vocabulary: ['search bar'] });
  expect(transcript.words.map(w => w.start)).toEqual([.1, .5]);
});

it.each(['en', 'hi-latn'])('rejects another script for selected %s', async language => {
  exec.mockImplementationOnce((_python, args, _options, callback) => {
    expect(args).toContain(language);
    callback(null, JSON.stringify({ language: 'ur', duration: 1, words: [{ text: '\u06c1\u0644\u0648', start: .1, end: .8, confidence: .9 }] }), '');
  });
  await expect(new LocalTranscriptionProvider({ model: 'small', device: 'cpu' }).transcribe('audio.wav', { language }))
    .rejects.toThrow('outside the selected language');
});

it('runs local recognition offline and preserves the returned text and word times', async () => {
  exec.mockImplementationOnce((_python, _args, options, callback) => {
    expect(options.env.HF_HUB_OFFLINE).toBe('1');
    callback(null, JSON.stringify({ language: 'hi', duration: 2, words: [{ text: 'नमस्ते', start: .1, end: 1, confidence: .8 }] }), '');
  });
  const provider = new LocalTranscriptionProvider({ model: 'small', device: 'cpu' });
  const result = await provider.transcribe('video audio.wav');
  expect(result.words[0]!.text).toBe('नमस्ते');
  expect(result.words[0]!.start).toBe(.1);
  expect(provider.name).toBe('local-whisper');
});
it('reports a missing local installation instead of creating demo text', async () => {
  exec.mockImplementationOnce((_python, _args, _options, callback) => callback(new Error('missing Python'), '', ''));
  await expect(new LocalTranscriptionProvider({ model: 'small', device: 'cpu' }).transcribe('audio.wav')).rejects.toThrow('Local speech transcription failed');
});
it('passes checkpoint and alignment choices and retains alignment diagnostics', async () => {
  exec.mockImplementationOnce((_python, args, options, callback) => {
    expect(args).toContain('checkpoints/hindi-ct2');
    expect(args).toContain('whisperx');
    expect(options.env.TRANSFORMERS_OFFLINE).toBe('1');
    callback(null, JSON.stringify({ language: 'en', duration: 2, words: [{ text: 'Hello', start: .3, end: .8, confidence: .9 }], diagnostics: { model: 'custom', computeType: 'int8', alignment: 'whisperx', alignedWords: 1, fallbackWords: 0, chunkCount: 1, speechSeconds: 1, warnings: [] } }), '');
  });
  const result = await new LocalTranscriptionProvider({ model: 'checkpoints/hindi-ct2', device: 'cpu', alignment: 'whisperx' }).transcribe('audio.wav');
  expect(result.diagnostics?.alignedWords).toBe(1);
});
