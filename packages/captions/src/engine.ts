/**
 * Caption engine — turns a Transcript's words into styled, editable Caption
 * objects using a chosen grouping strategy, and maps them to BurnGroups for the
 * video-engine burn renderer.
 */

const randomUUID = () => globalThis.crypto.randomUUID();
import type {
  BurnGroup,
  Caption,
  CaptionStyle,
  CaptionWord,
  Transcript,
} from '@clipx/types';

export type CaptionGrouping = 'sentence' | 'word' | 'auto' | 'custom';

export interface BuildCaptionsOptions {
  /** Clip time range (seconds) to caption. */
  clipStart: number;
  clipEnd: number;
  style: CaptionStyle;
  grouping: CaptionGrouping;
  script?: Caption['script'];
}

/** Build caption objects from a transcript within a clip range. */
export function buildCaptions(
  transcript: Transcript,
  opts: BuildCaptionsOptions,
): Caption[] {
  const words = transcript.words.filter(
    (w) => w.start >= opts.clipStart - 0.001 && w.end <= opts.clipEnd + 0.001,
  );

  const groups = groupWords(words, opts.grouping, opts.style.maxWordsPerGroup, transcript);
  let order = 0;
  return groups.map((group) => {
    const captionWords: CaptionWord[] = group.map((w) => ({
      id: randomUUID(),
      transcriptWordId: w.id,
      text: w.text,
      start: w.start,
      end: w.end,
      highlight: false,
    }));
    return {
      id: randomUUID(),
      clipId: '',
      script: opts.script ?? transcript.script,
      text: captionWords.map((w) => w.text).join(' '),
      start: captionWords[0]!.start,
      end: captionWords[captionWords.length - 1]!.end,
      words: captionWords,
      grouping: opts.grouping,
      order: order++,
      styleId: opts.style.id,
    };
  });
}

/** Group transcript words into caption lines. */
function groupWords(
  words: Transcript['words'],
  grouping: CaptionGrouping,
  maxWords: number,
  transcript: Transcript,
): Transcript['words'][] {
  if (words.length === 0) return [];

  if (grouping === 'word') {
    return words.map((w) => [w]);
  }

  if (grouping === 'sentence') {
    // Group by sentence boundary, then split long sentences by maxWords.
    const lines: Transcript['words'][] = [];
    let current: Transcript['words'] = [];
    for (const w of words) {
      current.push(w);
      const isSentenceStart = w.id === words[0]!.id || w.sentenceStart;
      if (isSentenceStart && current.length > 1) {
        lines.push([...current.slice(0, -1)]);
        current = [w];
      }
      if (current.length >= maxWords) {
        lines.push(current);
        current = [];
      }
    }
    if (current.length) lines.push(current);
    return lines;
  }

  // 'auto' or 'custom' → intelligent grouping: break on detected pauses and
  // cap line length so captions stay readable.
  const pauseThreshold = 0.35;
  const lines: Transcript['words'][] = [];
  let current: Transcript['words'] = [];
  for (const w of words) {
    const prev = current[current.length - 1];
    if (
      prev &&
      (w.start - prev.end > pauseThreshold || current.length >= maxWords)
    ) {
      lines.push(current);
      current = [];
    }
    current.push(w);
  }
  if (current.length) lines.push(current);
  return lines;
}

/** Convert Caption[] to BurnGroup[] for the video-engine renderer. */
export function captionsToBurnGroups(captions: Caption[]): BurnGroup[] {
  return captions.map((c) => ({
    start: c.start,
    end: c.end,
    words: c.words.map((w) => ({
      text: w.text,
      start: w.start,
      end: w.end,
      highlight: w.highlight ?? false,
    })),
  }));
}

export function captionsToSrt(captions: Pick<Caption, 'start' | 'end' | 'text'>[]): string {
  let n = 1;
  return captions
    .map((c) => `${n++}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.text}\n`)
    .join('\n');
}

export function captionsToVtt(captions: Pick<Caption, 'start' | 'end' | 'text'>[]): string {
  return 'WEBVTT\n\n' + captions.map((c) => `${srtTime(c.start).replace(',', '.')} --> ${srtTime(c.end).replace(',', '.')}\n${c.text}\n`).join('\n');
}

function srtTime(sec: number): string {
  const ms = Math.round(sec * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const mm = ms % 1000;
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(mm, 3)}`;
}
