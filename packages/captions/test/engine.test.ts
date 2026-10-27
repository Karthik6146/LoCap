import { describe, it, expect } from 'vitest';
import type { Caption, Transcript } from '@clipx/types';
import { DEFAULT_CAPTION_STYLE, buildCaptions, captionsToSrt, captionsToBurnGroups, editWordText, setWordTiming, HistoryStack } from '../src/index.js';

function makeTranscript(): Transcript {
  const words = [
    { id: 'w1', text: 'Guys', start: 0, end: 0.5, confidence: 0.9 },
    { id: 'w2', text: 'aaj', start: 0.5, end: 0.9, confidence: 0.9 },
    { id: 'w3', text: 'hum', start: 0.9, end: 1.2, confidence: 0.9 },
    { id: 'w4', text: 'ek', start: 1.2, end: 1.5, confidence: 0.9 },
    { id: 'w5', text: 'insane', start: 1.5, end: 1.9, confidence: 0.9 },
    { id: 'w6', text: 'match', start: 1.9, end: 2.3, confidence: 0.9 },
    { id: 'w7', text: 'dekhne', start: 2.3, end: 2.7, confidence: 0.9 },
    { id: 'w8', text: 'wale', start: 2.7, end: 3.0, confidence: 0.9 },
    { id: 'w9', text: 'hain', start: 3.0, end: 3.4, confidence: 0.9 },
  ];
  return {
    language: 'en',
    script: 'hi-latn',
    duration: 4,
    words,
    sentences: [
      { id: 's1', text: 'Guys aaj hum ek insane match dekhne wale hain', start: 0, end: 3.4, wordIds: words.map((w) => w.id), confidence: 0.9 },
    ],
    silences: [],
    confidence: 0.9,
  } as Transcript;
}

describe('caption engine', () => {
  it('builds captions with auto grouping and stable word timing', () => {
    const caps = buildCaptions(makeTranscript(), {
      clipStart: 0,
      clipEnd: 4,
      style: DEFAULT_CAPTION_STYLE,
      grouping: 'auto',
    });
    expect(caps.length).toBeGreaterThan(0);
    // every caption has word timings that match transcript
    const first = caps[0]!;
    expect(first.start).toBe(0);
    expect(first.words[0]!.start).toBe(0);
    expect(first.words[first.words.length - 1]!.end).toBeLessThanOrEqual(3.4);
  });

  it('editing word text preserves timing', () => {
    const caps = buildCaptions(makeTranscript(), {
      clipStart: 0, clipEnd: 4, style: DEFAULT_CAPTION_STYLE, grouping: 'word',
    });
    const target = caps.find((c) => c.words[0]!.text === 'insane')!;
    const edited = editWordText(target, target.words[0]!.id, 'EPIC');
    expect(edited.words[0]!.text).toBe('EPIC');
    expect(edited.words[0]!.start).toBe(target.words[0]!.start);
    expect(edited.words[0]!.end).toBe(target.words[0]!.end);
  });

  it('setWordTiming updates word + caption bounds', () => {
    const caps = buildCaptions(makeTranscript(), {
      clipStart: 0, clipEnd: 4, style: DEFAULT_CAPTION_STYLE, grouping: 'auto',
    });
    const cap: Caption = caps[0]!;
    const w = cap.words[0]!;
    const edited = setWordTiming(cap, w.id, 0.05, 0.6);
    expect(edited.words[0]!.start).toBe(0.05);
  });

  it('exports SRT with proper format', () => {
    const caps = buildCaptions(makeTranscript(), {
      clipStart: 0, clipEnd: 4, style: DEFAULT_CAPTION_STYLE, grouping: 'sentence',
    });
    const srt = captionsToSrt(caps);
    expect(srt).toContain('-->');
    expect(srt).toContain('00:00:00,000');
  });

  it('maps captions to burn groups', () => {
    const caps = buildCaptions(makeTranscript(), {
      clipStart: 0, clipEnd: 4, style: DEFAULT_CAPTION_STYLE, grouping: 'auto',
    });
    const burn = captionsToBurnGroups(caps);
    expect(burn.length).toBe(caps.length);
    expect(burn[0]!.words.length).toBe(caps[0]!.words.length);
  });

  it('history supports undo/redo', () => {
    const h = new HistoryStack<number>(10);
    h.record(0);
    h.record(1); // state about to move to 2
    expect(h.undo(2)).toBe(1);
    expect(h.redo(1)).toBe(2);
    expect(h.canUndo).toBe(true);
    h.record(2);
    expect(h.canRedo).toBe(false); // new branch clears redo
  });
});
