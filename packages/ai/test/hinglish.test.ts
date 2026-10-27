import { it, expect } from 'vitest';
import { romanizeHindi, toHinglish } from '../src/hinglish';
import type { Transcript } from '@clipx/types';
it('uses conversational whole-word spellings without rewriting English or similar Hindi words', () => {
  expect(romanizeHindi('काफी टाइम से हम वापस अपने काम पर हैं।')).toBe('kaafi time se hum wapas apne kaam par hain.');
  expect(romanizeHindi('कम काम me to')).toBe('kam kaam me to');
  expect(romanizeHindi('करना करते करता करती')).toBe('karna karte karta karti');
});
it('uses Roman Hindi and leaves English, numbers and punctuation intact', () => {
  expect(romanizeHindi('आज हम game में हैं!')).toBe('aaj hum game mein hain!');
  expect(romanizeHindi('नमस्ते दुनिया 123')).toBe('namaste duniyaa 123');
  expect(romanizeHindi('Hello, LoCap!')).toBe('Hello, LoCap!');
  expect(romanizeHindi('वीडियो १२३। game')).toBe('video 123. game');
});
it('preserves original transcript, IDs and word timings during conversion', () => {
  const source: Transcript = { language: 'hi', script: 'hi', duration: 1, confidence: .9, words: [{ id: 'a', text: 'आज', start: .1, end: .8, confidence: .9 }], sentences: [], silences: [] };
  const converted = toHinglish(source);
  expect(converted.words[0]).toEqual({ ...source.words[0], text: 'aaj' });
  expect(source.words[0]!.text).toBe('आज');
  expect(converted.script).toBe('hi-latn');
});
