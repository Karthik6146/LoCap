import { access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundledFontFiles } from '@clipx/captions';

/** Absolute path to the bundled caption fonts (unescaped). */
export function fontsDirectory(): string {
  return fileURLToPath(new URL('../../../apps/web/public/fonts', import.meta.url));
}

/** Throws for the first bundled font file missing from `dir`. */
export async function assertBundledFonts(dir = fontsDirectory()): Promise<void> {
  for (const name of bundledFontFiles()) {
    try { await access(path.join(dir, name)); }
    catch { throw new Error(`Caption font file ${name} is missing. Reinstall the bundled fonts.`); }
  }
}
