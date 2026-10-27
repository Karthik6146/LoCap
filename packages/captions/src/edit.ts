/**
 * Caption editing operations — pure, timing-preserving, undoable.
 * Editing a word's text never changes its timing unless timing is explicitly set.
 */

import type { Caption } from '@clipx/types';

/** Replace a word's text, keeping its start/end timestamps. */
export function editWordText(caption: Caption, wordId: string, newText: string): Caption {
  const words = caption.words.map((w) =>
    w.id === wordId ? { ...w, text: newText } : w,
  );
  return { ...caption, words, text: words.map((w) => w.text).join(' ') };
}

/** Explicitly set a word's timing (start/end). */
export function setWordTiming(
  caption: Caption,
  wordId: string,
  start: number,
  end: number,
): Caption {
  const words = caption.words.map((w) =>
    w.id === wordId ? { ...w, start, end } : w,
  );
  return {
    ...caption,
    words,
    start: words[0]?.start ?? start,
    end: words[words.length - 1]?.end ?? end,
  };
}

// ---------------------------------------------------------------------------
// Generic undo/redo history (snapshot-based, robust for editor state).
// ---------------------------------------------------------------------------

export class HistoryStack<T> {
  private past: T[] = [];
  private future: T[] = [];

  constructor(private readonly limit = 100) {}

  /** Record the state *before* a mutation is applied. Clears redo history. */
  record(previousState: T): void {
    this.past.push(previousState);
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
  }

  /** Undo: pass the current state; returns the previous state (or null). */
  undo(current: T): T | null {
    const prev = this.past.pop();
    if (prev == null) return null;
    this.future.push(current);
    return prev;
  }

  /** Redo: pass the current state; returns the next state (or null). */
  redo(current: T): T | null {
    const next = this.future.pop();
    if (next == null) return null;
    this.past.push(current);
    return next;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }
  get canRedo(): boolean {
    return this.future.length > 0;
  }
  clear(): void {
    this.past = [];
    this.future = [];
  }
}