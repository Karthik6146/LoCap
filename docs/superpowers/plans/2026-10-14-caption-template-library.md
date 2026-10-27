# Caption Template Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Grow ClipX from 18 to 40 original, categorized caption templates that render Roman Hinglish, mixed and Devanagari text identically in the browser preview and the libass MP4 export.

**Architecture:** A font registry in `packages/captions` becomes the single source for allowed fonts, Devanagari fallbacks and libass size ratios. Templates gain `category` and `tags`; the catalogue grows using only existing style capabilities. The gallery gets category chips, search and a sample-script switch. The worker refuses to render when a bundled font file is missing.

**Tech Stack:** TypeScript, Next.js 14 / React 18, Vitest, Playwright (Chromium), FFmpeg + libass, fontTools 4.65 in `.venv-whisper` (font instancing only).

**Spec:** `docs/superpowers/specs/2026-10-14-caption-template-library-design.md`

## Global Constraints
- No new rendering engine; libass via FFmpeg stays the export renderer.
- No new effects/motions; only existing style fields, the six animations (`none`, `fade`, `pop`, `bounce`, `karaoke`, `typewriter`) and `wordEffect` `plain | marker | neon`.
- No database schema change; styles stay in `Caption.data`.
- `fontWeight` stays `400 | 700`.
- Fonts: static TTF, SIL OFL, in `apps/web/public/fonts` with their OFL text files; total added ≤ 3 MB.
- All 18 existing template IDs keep working unchanged.
- Template names/colours are original; nothing copied from any competitor.
- No new npm dependencies.
- This folder is not a git repository: "Checkpoint" steps mean run the listed verification; do not run git commands.

## Review Focus
1. Saved project whose style uses a font/weight combination not in a template (e.g. Anton at 700) — must still open and export (validation must not tighten weight rules). Test in Task 1.
2. Custom template JSON importing an unbundled font (e.g. `"Comic Sans MS"`) or unbundled `devanagariFont` — must be rejected with a clear error. Test in Task 4.
3. Generation request with a new template ID — `parseGenerationOptions` must accept it (IDs live in `packages/types`). Test in Task 3.
4. Search that matches nothing, then switching category — empty state must offer "Clear filters" and restore all tiles. Test in Task 6.
5. Long Devanagari line in a large display font at 9:16 — must shrink to fit, not clip. Test in Task 5.

---

### Task 1: Font registry, bundled fonts and validation allowlist

**Files:**
- Create: `packages/captions/src/fonts.ts`
- Create: `packages/ai/scripts/instance_font.py` (one-off static-instance helper, kept for reproducibility)
- Add: `apps/web/public/fonts/{Poppins-Regular,Poppins-Bold,Baloo2-Bold,RozhaOne-Regular,Teko-Bold,PlayfairDisplay-Bold}.ttf` and `{Poppins,Baloo2,RozhaOne,Teko,PlayfairDisplay}-OFL.txt`
- Modify: `packages/captions/src/presentation.ts` (`assFontSize`), `packages/captions/src/document.ts:34,44`, `packages/captions/src/index.ts` (export), `apps/web/app/globals.css` (`@font-face`), `THIRD_PARTY_NOTICES.md`, `assets/caption-templates/README.md`
- Test: `packages/video-engine/test/animated-templates.test.ts` (metrics test), `packages/captions/test/document.test.ts`

**Interfaces:**
- Produces (`@clipx/captions`):
  - `BUNDLED_FONTS: Record<BundledFont, { files: Partial<Record<400 | 700, string>>; devanagari: boolean; cellToEm: number }>`
  - `type BundledFont = 'Montserrat' | 'Anton' | 'Noto Sans Devanagari' | 'Poppins' | 'Baloo 2' | 'Rozha One' | 'Teko' | 'Playfair Display'`
  - `LEGACY_SYSTEM_FONTS = ['Arial', 'Georgia', 'Impact'] as const`
  - `CAPTION_FONTS: readonly string[]` (bundled + legacy)
  - `DEVANAGARI_FONTS: readonly BundledFont[]` (entries with `devanagari: true`)
  - `bundledFontFiles(): string[]` (every file name in `BUNDLED_FONTS`)

- [ ] **Step 1: Fetch fonts.** Download from `https://github.com/google/fonts/raw/main/ofl/<dir>/`: `poppins/Poppins-Regular.ttf`, `poppins/Poppins-Bold.ttf`, `rozhaone/RozhaOne-Regular.ttf`, and the variable files `baloo2/Baloo2[wght].ttf`, `teko/Teko[wght].ttf`, `playfairdisplay/PlayfairDisplay[wght].ttf`, plus each directory's `OFL.txt`. Put downloads in a fresh scratch directory first.
- [ ] **Step 2: Instance variable fonts to static 700.** `instance_font.py <in> <out> 700` uses `fontTools.varLib.instancer.instantiateVariableFont(font, {"wght": 700}, updateFontNames=True)` and saves. Run with `.venv-whisper/Scripts/python.exe -I`. Outputs `Baloo2-Bold.ttf`, `Teko-Bold.ttf`, `PlayfairDisplay-Bold.ttf`. Confirm the family name (nameID 1/16) is `Baloo 2`, `Teko`, `Playfair Display` and subfamily `Bold`.
- [ ] **Step 3: Write the failing metrics test.** Replace the loop in `matches ASS-to-CSS font scaling…` to iterate `BUNDLED_FONTS` and every file in `files`, keeping the existing OS/2/head parsing: `expect(assFontSize(family, 20)).toBeCloseTo(20 * cell / em)`. Add `it('bundles every registry file')`: each `bundledFontFiles()` entry exists in `apps/web/public/fonts`, and total size of the six new files ≤ 3 * 1024 * 1024.
- [ ] **Step 4: Run, expect FAIL** — `npm run test -w @clipx/video-engine -- animated-templates` fails: `BUNDLED_FONTS` not exported.
- [ ] **Step 5: Implement `fonts.ts`.** Existing ratios: Montserrat 1.562, Noto Sans Devanagari 1.906, Anton 3550/2048. New ratios are `(usWinAscent + usWinDescent) / unitsPerEm` read from each TTF (use the test's parser once and paste the numbers with a comment naming the file). If two weights of one family differ, store the Bold value and note it. `assFontSize` reads `BUNDLED_FONTS[font]?.cellToEm ?? 1`.
- [ ] **Step 6: Write failing validation tests** in `document.test.ts`: `validateDocument` accepts a style for every `CAPTION_FONTS` entry; accepts `devanagariFont` for every `DEVANAGARI_FONTS` entry; rejects `font: 'Comic Sans MS'` and `devanagariFont: 'Playfair Display'`; accepts `{ font: 'Anton', fontWeight: 700 }` (Review Focus 1).
- [ ] **Step 7: Implement validation.** `document.ts:34` checks `DEVANAGARI_FONTS.includes(s.devanagariFont)`; the font list at line 44 becomes `CAPTION_FONTS.includes(s.font)`. Widen `devanagariFont?` in `packages/types/src/caption.ts:57` to `string` (validated at runtime; `packages/types` cannot import captions).
- [ ] **Step 8: CSS + notices.** One `@font-face` per new file in `globals.css` (same pattern as Montserrat, `font-display: block`). Add each family, source URL and "SIL Open Font License 1.1" to `THIRD_PARTY_NOTICES.md` and `assets/caption-templates/README.md`.
- [ ] **Step 9: Checkpoint** — `npm run test -w @clipx/captions` and `npm run test -w @clipx/video-engine -- animated-templates` PASS; `npm run typecheck` PASS.

### Task 2: Devanagari font follows the template

**Files:**
- Modify: `packages/captions/src/presentation.ts:5` (`captionFont`)
- Test: `packages/captions/test/presentation.test.ts`

**Interfaces:**
- Consumes: `DEVANAGARI_FONTS` (Task 1).
- Produces: `captionFont(text: string, style: CaptionStyle): string` returns `style.devanagariFont ?? 'Noto Sans Devanagari'` when `text` contains Devanagari, else `style.font`.

- [ ] **Step 1: Failing test** `it('uses the template Devanagari font')`: `captionFont('आज', { ...style, devanagariFont: 'Baloo 2' })` → `'Baloo 2'`; without `devanagariFont` → `'Noto Sans Devanagari'`; `captionFont('aaj', { ...style, font: 'Poppins', devanagariFont: 'Baloo 2' })` → `'Poppins'`.
- [ ] **Step 2: Run, expect FAIL** (`'Noto Sans Devanagari'` returned).
- [ ] **Step 3: Implement** the one-line change.
- [ ] **Step 4: Checkpoint** — `npm run test -w @clipx/captions` and `npm run test -w @clipx/video-engine` PASS (existing ASS tests still see Noto for templates without `devanagariFont`).

### Task 3: Categorized catalogue of 40 templates

**Files:**
- Modify: `packages/captions/src/templates.ts`, `packages/types/src/generation.ts:3`
- Test: `packages/captions/test/templates.test.ts`

**Interfaces:**
- Consumes: `CAPTION_FONTS`, `DEVANAGARI_FONTS` (Task 1).
- Produces:
  - `type TemplateCategory = 'bold' | 'minimal' | 'podcast' | 'gaming' | 'luxury' | 'hindi'`
  - `TEMPLATE_CATEGORIES: readonly { id: TemplateCategory; label: string }[]` in display order bold, minimal, podcast, gaming, luxury, hindi with labels Bold, Minimal, Podcast, Gaming, Luxury, Hindi
  - `CaptionTemplate` adds `category: TemplateCategory; tags: string[]`
  - `CAPTION_TEMPLATES` (40 entries); `templateStyle`, `ANIMATED_TEMPLATE_CONFIGS` unchanged in signature
  - `CAPTION_TEMPLATE_IDS` in `@clipx/types` lists all 40 IDs

Legacy categories: bold — bold-yellow-pop, pop-box, bounce-word, marker-highlight, creator, gold; minimal — clean-minimal, typewriter, minimal, contrast, clean; podcast — karaoke-fill, rose, boxed; gaming — neon-gaming, mint, electric; luxury — editorial.

New templates (22). Hindi-first gets 6 instead of the spec's 3 because Hinglish/Hindi is the stated priority; other categories shrink to keep 22. Values not listed come from `EDITOR_STYLE`; `devanagariFont` defaults to the font itself when it is Devanagari-capable, else `'Poppins'`.

| id | name | category | font / weight | animation · effect | highlight | words | notes |
|---|---|---|---|---|---|---|---|
| shout | Shout | bold | Poppins 700 | pop | #FF3B3B | 2 | stroke 4 |
| punch | Punch | bold | Poppins 700 | pop | #111111 on box | 3 | white box, black text |
| headline | Headline | bold | Teko 700 | bounce | #FFE14D | 3 | stroke 3 |
| sticker | Sticker | bold | Baloo 2 700 | bounce | #FF7AC6 | 3 | stroke 5 |
| whisper | Whisper | minimal | Poppins 400 | fade | off | 5 | stroke 1 |
| subtitle-classic | Subtitle Classic | minimal | Poppins 400 | none | off | 7 | positionY .88 |
| soft-box | Soft Box | minimal | Poppins 400 | fade | off | 6 | box #000000 .6 |
| talk-show | Talk Show | podcast | Poppins 700 | karaoke | #7DD3FC | 5 | stroke 2 |
| interview | Interview | podcast | Poppins 400 | fade | #FDE68A | 6 | box #0B1220 .85 |
| storyteller | Storyteller | podcast | Playfair Display 700 | karaoke | #FCA5A5 | 4 | |
| quote-card | Quote Card | podcast | Rozha One 400 | fade | #F5D0A9 | 5 | box #1A1410 .9 |
| arcade | Arcade | gaming | Teko 700 | pop · neon | #39FF6A | 3 | |
| rage | Rage | gaming | Baloo 2 700 | bounce | #FF4D4D | 2 | stroke 6 |
| level-up | Level Up | gaming | Teko 700 | pop · marker | #A78BFA | 3 | |
| gold-serif | Gold Serif | luxury | Playfair Display 700 | fade | #E8C36A | 4 | devanagariFont Rozha One |
| noir | Noir | luxury | Rozha One 400 | fade | off | 5 | color #F3E9D7 |
| desi-pop | Desi Pop | hindi | Baloo 2 700 | pop | #FFB800 | 3 | |
| bollywood-marquee | Bollywood Marquee | hindi | Rozha One 400 | fade | #FF5DA2 | 3 | stroke 3 |
| hindi-bold-box | Hindi Bold Box | hindi | Poppins 700 | pop | #FFFFFF on box | 3 | box #C2185B .95 |
| tez-karaoke | Tez Karaoke | hindi | Poppins 700 | karaoke | #FFD60A | 4 | |
| saaf | Saaf | hindi | Poppins 400 | fade | off | 5 | stroke 2 |
| dhamaka | Dhamaka | hindi | Teko 700 | bounce · neon | #FF6B00 | 2 | |

Hindi-first templates (`category: 'hindi'`) use `maxWordsPerGroup` ≤ 4 except Saaf and a 1.15× font size: `templateStyle` multiplies its computed `fontSize` by 1.15 when `category === 'hindi'` (still clamped 16–160).

- [ ] **Step 1: Failing catalogue tests** in `templates.test.ts`:
  - `CAPTION_TEMPLATES.length` === 40; IDs unique; set of IDs equals `CAPTION_TEMPLATE_IDS`.
  - Every template: category in `TEMPLATE_CATEGORIES`, `tags.length >= 2`, `name.length <= 40`, `validateDocument({ captions: [], style }, 0)` does not throw, `style.font` and `style.devanagariFont ?? 'Noto Sans Devanagari'` have `BUNDLED_FONTS` or `LEGACY_SYSTEM_FONTS` entries.
  - The 18 legacy IDs listed above exist with the listed categories, and `templateStyle(id, 1080)` equals its value before this task for each (snapshot the 18 styles in the test before editing).
  - Category counts: bold 10, minimal 8, podcast 7, gaming 6, luxury 3, hindi 6.
  - `parseGenerationOptions({ outputLanguage: 'hinglish', templateId: 'desi-pop' }).templateId` === `'desi-pop'` (Review Focus 3).
- [ ] **Step 2: Run, expect FAIL** — `npm run test -w @clipx/captions -- templates`.
- [ ] **Step 3: Implement** categories/tags on all 40 entries (tags: 2–5 lowercase words describing look, e.g. `['karaoke', 'blue', 'calm']`), the 22 rows above, the Hindi size factor, and the 40-ID list in `generation.ts`.
- [ ] **Step 4: Checkpoint** — `npm run test -w @clipx/captions`, `npm run typecheck` PASS.

### Task 4: Production guards — font check, import allowlist, legacy label

**Files:**
- Create: `packages/video-engine/src/fonts.ts`
- Modify: `packages/video-engine/src/captions.ts:137` (use `fontsDirectory()`), `packages/video-engine/src/index.ts` (export), `apps/worker/src/index.ts` (`main`), `apps/web/components/custom-caption-templates.tsx`
- Test: `packages/video-engine/test/caption-style.test.ts`, `packages/captions/test/templates.test.ts`

**Interfaces:**
- Consumes: `bundledFontFiles()` (Task 1), `CAPTION_TEMPLATES` (Task 3).
- Produces: `fontsDirectory(): string` (absolute path to `apps/web/public/fonts`); `assertBundledFonts(dir = fontsDirectory()): Promise<void>` throws `Error('Caption font file <name> is missing. Reinstall the bundled fonts.')` for the first missing file.

- [ ] **Step 1: Failing tests.**
  - `assertBundledFonts(emptyTmpDir)` rejects with a message containing `is missing`; `assertBundledFonts()` resolves.
  - `parseCustomTemplate({ name: 'x', style: { ...style, font: 'Comic Sans MS' } })` throws; same for `devanagariFont: 'Arial'` (Review Focus 2).
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.** `burnCaptions` awaits `assertBundledFonts()` before spawning FFmpeg, so every caption export job fails visibly through existing job error handling. Worker `main()` awaits it after the startup log and on failure logs the message and exits with code 1. `parseCustomTemplate` already calls `validateDocument`; confirm the Task 1 allowlist makes the tests pass without extra code.
- [ ] **Step 4: Legacy label.** In `CustomCaptionTemplates`, when the current `style.id` matches neither a `CAPTION_TEMPLATES` id nor a saved custom template, render `<p role="status" className="text-sm text-gray-400">Current style: Custom (legacy)</p>` above the gallery. Covered by the browser test in Task 6.
- [ ] **Step 5: Checkpoint** — `npm run test -w @clipx/video-engine`, `npm run test -w @clipx/captions`, `npm run test -w @clipx/worker` PASS.

### Task 5: Script and aspect coverage for every template

**Files:**
- Modify: `packages/video-engine/test/animated-templates.test.ts`

**Interfaces:**
- Consumes: `CAPTION_TEMPLATES`, `templateStyle`, `captionFont`, `fitCaptionStyle`, `buildAss`.

- [ ] **Step 1: Write the tests.**
  - `it('serializes every template for Roman, mixed and Devanagari lines')`: for each of the 40 templates × samples `['Aaj hum website bana rahe', 'आज website क्षेत्र में है', 'आज कुछ नया सीखते हैं']` × sizes 1080×1920, 1920×1080, 1080×1080: `buildAss([group], templateStyle(id, h), w, h)` contains `\fn<captionFont(devanagariWord, style)>` for Devanagari samples, contains no control bytes (reuse the existing check), and `fitCaptionStyle(group, style, w).fontSize <= style.fontSize`.
  - `it('fits a long Devanagari line in large display fonts at 9:16')` (Review Focus 5): group of 'प्रधानमंत्री राष्ट्रीय स्वास्थ्य कार्यक्रम घोषणा' with `bollywood-marquee` and `dhamaka` at 1080×1920; estimated line width (`ems * fittedSize * 1.16`) ≤ `1080 * .84`.
  - Replace `ANIMATED_TEMPLATE_CONFIGS` with `CAPTION_TEMPLATES` in the existing burn test only if runtime stays under 3 minutes; otherwise keep the burn test on the 8 configs (Task 7 covers all 40).
- [ ] **Step 2: Run** `npm run test -w @clipx/video-engine` — expect PASS; any failure points at a template value in Task 3 or a ratio in Task 1, fix there.
- [ ] **Step 3: Checkpoint** — full `npm run test` PASS.

### Task 6: Gallery — categories, search, script switch, lazy previews

**Files:**
- Modify: `apps/web/components/caption-templates.tsx`, `apps/web/components/custom-caption-templates.tsx`, `apps/web/components/generation-options.tsx` (unchanged props; verify), `apps/web/app/globals.css`
- Test: `apps/web/test/browser.mjs`

**Interfaces:**
- Consumes: `CAPTION_TEMPLATES`, `TEMPLATE_CATEGORIES` (Task 3).
- Produces: `TemplateGallery({ selected, onSelect, templates?, custom?, onSelectCustom? })` — `custom` templates appear only under a "My templates" chip; `CustomCaptionTemplates` passes its saved templates through `custom` instead of rendering a second gallery.

Behaviour:
- Chips: All, the six categories, and "My templates" (only when `custom.length > 0`), rendered as `role="radiogroup"` `aria-label="Template category"` with `role="radio"` buttons, arrow-key navigation, one tab stop.
- Search: `<input type="search" aria-label="Search templates">` matching case-insensitively on name, tags and category label.
- Live region `role="status"`: "`N` templates" (or "1 template").
- Empty: "No templates match." plus a `Clear filters` button resetting search and category to All.
- Script switch: `role="radiogroup"` `aria-label="Preview text"` with Hinglish ("Aaj kuch naya"), Hindi ("आज कुछ नया"), English ("Something new today"); replaces the fixed `sample`.
- Previews animate only when the tile is intersecting (IntersectionObserver, `rootMargin: '100px'`); off-screen tiles render the static frame.
- Remember last category in `localStorage` key `clipx-template-category`, read/write inside try/catch; invalid stored value → All.

- [ ] **Step 1: Failing browser assertions** in `browser.mjs` (studio section, before existing template loop):
  - `getByRole('radio', { name: 'Hindi' })` click → visible tiles all have Hindi templates, status reads "6 templates".
  - Fill search `zzz` → "No templates match." visible; click `Clear filters` → status reads "40 templates" (Review Focus 4).
  - Choose preview text Hindi → first visible tile preview contains `आज`.
  - Keyboard: focus Bold chip, press ArrowRight → Minimal chip checked.
  - Select `Desi Pop`, Save changes, reload → `Desi Pop` tile `aria-pressed="true"` and category chip remembered.
  - Existing custom-template steps updated to click "My templates" before asserting `My test style Saved`.
  - Legacy: set a saved document's `style.id` to `'retired-template'` via the database fixture → page shows "Current style: Custom (legacy)".
- [ ] **Step 2: Build and run, expect FAIL** — `NEXT_BUILD_DIR=.next-verify npx next build` in `apps/web`, then `NEXT_BUILD_DIR=.next-verify npm run test:browser -w @clipx/web`.
- [ ] **Step 3: Implement** the behaviour above; chip/search styles go in `globals.css` using existing tokens; text ≥ 12px, targets ≥ 24px.
- [ ] **Step 4: Run, expect PASS**; also existing generation-options flow (upload page gallery) still selects templates.
- [ ] **Step 5: Checkpoint** — `npm run typecheck`, browser test PASS, remove `.next-verify`.

### Task 7: Render check and contact sheets

**Files:**
- Create: `apps/web/test/render-check.mjs`
- Modify: `apps/web/package.json` (script `"test:render": "node --import tsx test/render-check.mjs"`)

**Interfaces:**
- Consumes: `CAPTION_TEMPLATES`, `templateStyle`, `burnCaptions`, `generateTestVideo` (video-engine), the isolated-server setup pattern from `browser.mjs` (temp DB, `next start` on a free port).

Method (no new dependencies):
- Source: 2-second 640×360 solid `#202020` video via FFmpeg `color` source.
- For each template × the three Task 5 samples: burn with `burnCaptions` at t=1.0s; extract the frame with FFmpeg to raw `gray` bytes.
- Browser: seed one project/video using that solid source (same fixture pattern as `browser.mjs`). For each template × sample, write the caption document (`templateStyle(id, 360)` + the sample group) to the database, reload the Caption studio, set `video.currentTime = 1.0`, wait for `document.fonts.ready`, screenshot `.studio-preview`, and convert the PNG to raw `gray` at 640×360 with FFmpeg.
- Bounding box: pixels with |value − 32| > 40. Pass when left/right/top/bottom each differ by ≤ 6% of frame width/height.
- Write `artifacts/template-contact-<script>.png` per script via FFmpeg `tile` of all 40 exported frames (8 columns), labelled with `drawtext` template name.
- Print a table of template × script with PASS/FAIL; exit 1 on any FAIL.

- [ ] **Step 1: Implement the script** as above.
- [ ] **Step 2: Run** `npm run test:render -w @clipx/web` after a `.next-verify` build — expect all 120 PASS. A FAIL means fix the template value (Task 3) or font ratio (Task 1); a font whose Devanagari shaping differs persistently is removed from `DEVANAGARI_FONTS` and its templates fall back to Poppins (spec risk rule).
- [ ] **Step 3: Visual review** — open the three contact sheets; confirm no clipped glyphs, broken conjuncts or tofu boxes.
- [ ] **Step 4: Checkpoint** — record pass counts.

### Task 8: Documentation and final verification

**Files:**
- Modify: `docs/tasks.md`, `docs/caption-templates.md`, `docs/memory.md` (one line), `docs/design.md` if gallery visuals are described there

- [ ] **Step 1:** `docs/caption-templates.md`: font registry, how to add a template (row in catalogue + ID in `CAPTION_TEMPLATE_IDS` + render check), how to add a font (TTF + OFL + `BUNDLED_FONTS` ratio + `@font-face`).
- [ ] **Step 2:** `docs/tasks.md` section "Caption template library (date)" with what changed, verification results and limits.
- [ ] **Step 3: Final verification** — `npm run test` (all workspaces), `npm run typecheck`, isolated `next build`, `npm run test:browser -w @clipx/web`, `npm run test:render -w @clipx/web`; open an existing project in the running dev server and confirm its captions look unchanged.
- [ ] **Step 4:** Send the user the three contact sheets for review (spec acceptance criterion).
