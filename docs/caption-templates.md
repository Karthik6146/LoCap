# Animated caption templates

The existing CaptionDocument remains the saved format: captions contain words with absolute start/end seconds and a CaptionStyle. Template selection edits that document, never the transcript or ASR job. Changing words per caption repages contiguous speech using existing word IDs/text/timestamps; Undo restores previous grouping. Pauses longer than 350 ms remain boundaries.

## Implementation

- `packages/captions/src/templates.ts`: configuration registry, eight animated presets plus legacy presets and validated custom JSON templates.
- `packages/captions/src/presentation.ts`: shared seekable word state, grapheme segmentation, placement, conservative line fitting, font metrics and repaging.
- `apps/web/components/caption-overlay.tsx`: React/CSS adapter; used by both the live editor and template thumbnails. Gallery animation is opt-in and respects reduced motion.
- `packages/video-engine/src/captions.ts`: existing FFmpeg/libass adapter. It emits events at actual word boundaries and short 25 Hz motion intervals. Typewriter emits only grapheme reveal boundaries. No browser renderer, cloud dependency or new transcription is needed.
- Font assets: bundled static Montserrat and Noto Sans Devanagari regular/bold TTFs, about 1.2 MB total. Generated from Google Fonts variable fonts using FontTools' axis instancer; OFL notices accompany them. Both adapters select Noto for words containing Devanagari, including mixed-script words.

The eight presets are Bold Yellow Pop, Karaoke Fill, Pop Box, Bounce Word, Clean Minimal, Neon Gaming, Marker Highlight and Typewriter. Karaoke Fill accumulates color word by word; it does not guess intra-word phoneme timing. Typewriter reveals Unicode grapheme clusters, including Hindi matras/conjuncts. Marker text automatically switches between dark/light for contrast against the selected highlight color.

Style customization covers font/weight/size, text/highlight/outline/background/shadow colors, outline width, alignment, position, words per caption, animation and strength. Existing browser-local template save/import/export works with these settings. Strength zero disables motion/reveal effects while retaining timed color highlights.

## Preview and export

The source dimensions remain unchanged: 9:16, 16:9 and 1:1 use normalized placement and the same conservative single-line fit. The size control is a maximum source-pixel size; long lines shrink to reserve space for outlines and motion. No crop or aspect conversion occurs when selecting a template.

Custom placement is adjusted by dragging the caption in the live preview (mouse or touch), or with arrow keys after focusing it. A gesture makes one undo step; cancelled gestures restore the starting placement. Optional `positionX`/`positionY` fractions are validated within .08–.92, saved with the style and used by both renderers. Horizontal custom placement uses a center anchor; longer future lines fit the available space near the edges. Legacy alignment/edge-offset styles remain valid. Save changes and export a new MP4 to apply placement; SRT/VTT contain no visual styling.

Both adapters share timestamp-derived states, fonts, colors, scale and placement. Export accounts for ASS's Windows-cell font sizing versus CSS em sizing using metrics from the bundled files, and halves CSS stroke diameter for ASS's outward border radius. Font-metric tests detect asset changes. ASS timing precision is 10 ms; short motion transitions use 40 ms steps. Browser/libass rasterization, line-box backgrounds and glow edges can still differ slightly; legacy system fonts remain device-dependent. The new bundled presets avoid system font dependence.

## Add another template

1. Add an object to `ANIMATED_TEMPLATE_CONFIGS` in `packages/captions/src/templates.ts`, with a unique descriptive ID/name, supported animation, activeColor and outlineWidth. Optional `box`, `quiet` and `effect` configure the current shared renderer. The mapping supplies common typography, fallback, placement and word count; extend its typed configuration if another per-template default is needed.
2. Add the ID to `CAPTION_TEMPLATE_IDS` in `packages/types/src/generation.ts`, which validates upload/regenerate settings without creating a package dependency cycle.
3. For a new effect, implement it in the shared presentation state and both adapters, extend document validation, then add regression coverage. Never add CSS-only animation that export cannot reproduce.
4. Run `npm run test`, `npm run typecheck`, `npm run build:web`, then `npm run test:browser -w @clipx/web`. If using `.next-check`, set `NEXT_BUILD_DIR=.next-check` for both build and browser test. `npm run lint` currently requires an ESLint configuration that this checkout does not contain.

The MIT tscaps template directory informed the configuration/word-state design only. No complete application, editor code, Sass or runtime dependency was imported. Attribution and MIT text are in `THIRD_PARTY_NOTICES.md`. Reference: https://github.com/francozanardi/tscaps/tree/main/templates. Font-size rationale: https://github.com/libass/libass/issues/739.

## Files changed for this feature

- `packages/types/src/caption.ts`, `packages/types/src/generation.ts`
- `packages/captions/src/templates.ts`, `document.ts`, `presentation.ts`, `index.ts`; `test/presentation.test.ts`
- `packages/video-engine/src/captions.ts`, `package.json`; `test/animated-templates.test.ts`; root `package-lock.json`
- `apps/web/components/caption-templates.tsx`, `caption-overlay.tsx`; `apps/web/app/app/captions/[videoId]/editor.tsx`; `apps/web/app/globals.css`; `apps/web/test/browser.mjs`
- Template library (2026-10-14): `apps/web/public/fonts/{Poppins-Regular,Poppins-Bold,Baloo2-Bold,RozhaOne-Regular,Teko-Bold,PlayfairDisplay-Bold}.ttf` with `Poppins-OFL.txt`, `Baloo2-OFL.txt`, `RozhaOne-OFL.txt`, `Teko-OFL.txt`, `PlayfairDisplay-OFL.txt`; `packages/captions/src/fonts.ts`, `packages/video-engine/src/fonts.ts`
- `apps/web/public/fonts/Montserrat-{Regular,Bold}.ttf`, `NotoSansDevanagari-{Regular,Bold}.ttf` and each family's `-OFL.txt`
- `THIRD_PARTY_NOTICES.md`, `docs/caption-templates.md`, `docs/tasks.md`, `docs/memory.md`, `docs/design.md`

Browser sample captures: `artifacts/template-*.png`; inspected FFmpeg comparison frames: `artifacts/template-export-*.png`. Fixtures contain synthetic media only.

## Template library (2026-10-14)

40 templates (the 18 legacy styles plus 22 new ones) are grouped into categories (`TEMPLATE_CATEGORIES` in `templates.ts`: Bold, Minimal, Podcast, Gaming, Luxury, Hindi). Each `CaptionTemplate` has a `category` and search `tags`. The Hindi category renders at 1.15x size in `templateStyle`. Legacy style output is pinned by the snapshot `packages/captions/test/legacy-template-styles.json`. Template IDs are mirrored in `CAPTION_TEMPLATE_IDS` (`packages/types/src/generation.ts`).

Gallery (`apps/web/components/caption-templates.tsx`): category chips plus My templates, search with live count and empty state, a preview-text switch (Hinglish/Hindi/English), lazily rendered previews and a remembered category (`localStorage` key `clipx-template-category`). Styles that match no catalogue ID show "Current style: Custom (legacy)".

### Font registry

`packages/captions/src/fonts.ts` is the single source: `BUNDLED_FONTS` maps family to `files` (weight 400/700 to TTF name), a `devanagari` flag and `cellToEm` (libass OS/2 usWinAscent+usWinDescent over unitsPerEm, measured from the TTF). Derived: `LEGACY_SYSTEM_FONTS` (Arial, Georgia, Impact; device-dependent), `CAPTION_FONTS`, `DEVANAGARI_FONTS`, `bundledFontFiles()`. `captionFont` uses `style.devanagariFont ?? 'Noto Sans Devanagari'` for words containing Devanagari. `packages/video-engine/src/fonts.ts` provides `fontsDirectory()` and `assertBundledFonts()`; `burnCaptions` and worker startup fail with a clear error if a bundled file is missing.

Bundled families: Montserrat, Anton, Noto Sans Devanagari, Poppins 400/700, Baloo 2 700, Rozha One 400, Teko 700, Playfair Display 700 (Latin only). Playfair Display Bold is the unmodified upstream v1.202 static file. Other new static instances were made with `packages/ai/scripts/instance_font.py`; each has an OFL notice in `apps/web/public/fonts`.

### Add a template

1. Add a row to the template catalogue in `packages/captions/src/templates.ts` with a unique ID, `category` and `tags`.
2. Add the ID to `CAPTION_TEMPLATE_IDS` in `packages/types/src/generation.ts`.
3. Run the render check (below) and inspect the contact sheets.

### Add a font

1. Add the static TTF (400 and/or 700) and its OFL text to `apps/web/public/fonts`; add them to `THIRD_PARTY_NOTICES.md`.
2. Add a `BUNDLED_FONTS` entry (files, devanagari flag, measured `cellToEm`) and extend the `BundledFont` type.
3. Add `@font-face` rules in `apps/web/app/globals.css` (use `font-display: block`).
4. A single-weight font synthesizes the other weight; check the result in the contact sheets.

### Render check

Build in an isolated directory, then run the check from `apps/web`: `NEXT_BUILD_DIR=.next-verify npx next build`, then `NEXT_BUILD_DIR=.next-verify npm run test:render` (also `npm run test:render -w @clipx/web` with the same variable). It renders every template in a single 640x360 (16:9) frame, 120 cases = 40 templates x Roman/mixed/Devanagari text; 9:16/16:9/1:1 coverage comes from the video-engine unit tests (`animated-templates.test.ts`). It compares browser and libass output, and writes `artifacts/template-contact-{roman,mixed,devanagari}.png`. Delete `.next-verify` afterwards; never use `.next` while a dev server runs.

### Known limits

- Single-weight fonts synthesize the other weight.
- Preview sample text in narrow tiles is decorative and may render below 12px.
- Rozha One and Teko templates look visibly smaller than Poppins templates at the same size.
- Playfair Display: resolved by bundling the unmodified upstream v1.202 static Bold TTF (no self-made instance).
- Lint is unconfigured; Safari/Firefox not tested.
