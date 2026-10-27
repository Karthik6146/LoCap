/**
 * Caption script switching (spec section 8) — Roman Hinglish ↔ native Hindi,
 * without changing timing or meaning. Word-level so timestamps stay stable.
 */

import type { CaptionScript } from '@clipx/types';

/** Small Roman-Hinglish → Devanagari mapping for common words (dev-grade). */
const ROMAN_TO_HINDI: Record<string, string> = {
  aaj: 'आज', hum: 'हम', ek: 'एक', dekhne: 'देखने', wale: 'वाले', hain: 'हैं',
  hai: 'है', tha: 'था', thi: 'थी', the: 'थे', aur: 'और', mein: 'में', se: 'से',
  ke: 'के', ki: 'की', ko: 'को', par: 'पर', kya: 'क्या', kyun: 'क्यों',
  kaise: 'कैसे', nahi: 'नहीं', mera: 'मेरा', meri: 'मेरी', tum: 'तुम',
  tumhara: 'तुम्हारा', yeh: 'यह', woh: 'वह', chalo: 'चलो', bhai: 'भाई',
  yaar: 'यार', matlab: 'मतलब', abhi: 'अभी', kal: 'कल', bahut: 'बहुत',
  great: 'ग्रेट', kaam: 'काम', kar: 'कर', karo: 'करो', dekho: 'देखो',
  jaane: 'जाने', aana: 'आना', aaya: 'आया', gaya: 'गया', khel: 'खेल',
};

/**
 * Convert a word's script. `source` is the current word text; `target` is the
 * desired caption script. Returns the same word for 'en'/'mixed' (no change),
 * or a Devanagari form for 'hi'.
 */
export function convertWordScript(
  word: string,
  target: CaptionScript,
  source: CaptionScript = 'hi-latn',
): string {
  if (target === 'en' || target === 'mixed') return word;
  if (target === 'hi-latn') return word;
  // target === 'hi' (native Devanagari)
  if (source === 'hi') return word; // already native
  const mapped = ROMAN_TO_HINDI[word.toLowerCase()];
  return mapped ?? word;
}

/** Convert a full caption line script while preserving word count/timing. */
export function convertLineScript(
  words: string[],
  target: CaptionScript,
  source: CaptionScript = 'hi-latn',
): string[] {
  return words.map((w) => convertWordScript(w, target, source));
}
