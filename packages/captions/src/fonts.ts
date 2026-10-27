export type BundledFont = 'Montserrat' | 'Anton' | 'Noto Sans Devanagari' | 'Poppins' | 'Baloo 2' | 'Rozha One' | 'Teko' | 'Playfair Display';

/** cellToEm = libass OS/2 (usWinAscent + usWinDescent) / unitsPerEm, measured from the bundled TTFs. */
/** opticalScale = Poppins glyph height per em / this font's (Devanagari क, Latin H; fontTools), so templates look equally large. */
export const BUNDLED_FONTS: Record<BundledFont, { files: Partial<Record<400 | 700, string>>; devanagari: boolean; cellToEm: number; opticalScale?: number }> = {
  Montserrat: { files: { 400: 'Montserrat-Regular.ttf', 700: 'Montserrat-Bold.ttf' }, devanagari: false, cellToEm: 1.562 },
  Anton: { files: { 400: 'Anton-Regular.ttf' }, devanagari: false, cellToEm: 3550 / 2048 },
  'Noto Sans Devanagari': { files: { 400: 'NotoSansDevanagari-Regular.ttf', 700: 'NotoSansDevanagari-Bold.ttf' }, devanagari: true, cellToEm: 1.906 },
  Poppins: { files: { 400: 'Poppins-Regular.ttf', 700: 'Poppins-Bold.ttf' }, devanagari: true, cellToEm: 1.762 }, // 1762/1000, both weights
  'Baloo 2': { files: { 700: 'Baloo2-Bold.ttf' }, devanagari: true, cellToEm: 1.574, opticalScale: 1.15 }, // Baloo2-Bold.ttf 1574/1000
  'Rozha One': { files: { 400: 'RozhaOne-Regular.ttf' }, devanagari: true, cellToEm: 1.42, opticalScale: 1.3 }, // RozhaOne-Regular.ttf 1420/1000
  Teko: { files: { 700: 'Teko-Bold.ttf' }, devanagari: true, cellToEm: 1.433, opticalScale: 1.15 }, // Teko-Bold.ttf 1433/1000
  'Playfair Display': { files: { 700: 'PlayfairDisplay-Bold.ttf' }, devanagari: false, cellToEm: 1410 / 1240, opticalScale: 1.2 }, // PlayfairDisplay-Bold.ttf (upstream v1.202 static) 1410/1240
};

export const LEGACY_SYSTEM_FONTS = ['Arial', 'Georgia', 'Impact'] as const;
export const CAPTION_FONTS: readonly string[] = [...Object.keys(BUNDLED_FONTS), ...LEGACY_SYSTEM_FONTS];
export const DEVANAGARI_FONTS = (Object.keys(BUNDLED_FONTS) as BundledFont[]).filter(f => BUNDLED_FONTS[f].devanagari);
export const bundledFontFiles = (): string[] => Object.values(BUNDLED_FONTS).flatMap(f => Object.values(f.files));
