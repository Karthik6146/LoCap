# Caption Template Library — Design (Sub-project A)

Date: 2026-10-14 · Status: awaiting review

## Goal
Grow ClipX from 18 caption templates to at least 40 original, categorized templates that render correctly for Roman Hinglish, mixed Hindi/English and Devanagari Hindi, and look the same in the browser preview and the exported MP4. Production grade means: validated data, bundled fonts checked before use, no silent font fallback, and existing projects unaffected.

Inspiration: feature list of a competing caption product (template count, categories, search). No code, assets, names or colours are copied.

## Out of scope
- New rendering engine. libass via FFmpeg stays the export renderer.
- New effects or motions (gradients, glow, rotation, per-line styling, emphasis keywords).
- Hinglish ↔ Devanagari output switching and accuracy work (sub-project B). Templates here only need to render both scripts.
- Database schema changes. Styles remain in `Caption.data`.

## 1. Template data model and library
File: `packages/captions/src/templates.ts`.

- `CaptionTemplate` gains `category: 'bold' | 'minimal' | 'podcast' | 'gaming' | 'luxury' | 'hindi'` and `tags: string[]`.
- One typed list holds all templates. The 18 existing IDs (8 animated configs + 10 presets) are kept unchanged and assigned categories.
- About 22 new templates use only existing style capabilities: font, weight, colours, stroke, shadow, box background, active-word highlight, the six animations (`none`, `fade`, `pop`, `bounce`, `karaoke`, `typewriter`), `marker`/`neon` word effects and words per group.

| Category | New | Examples |
|---|---|---|
| bold | 5 | Shout, Punch |
| minimal | 4 | Whisper, Subtitle Classic |
| podcast | 4 | Talk Show, Interview |
| gaming | 3 | Arcade, Rage |
| luxury | 3 | Gold Serif, Noir |
| hindi | 3 | Desi Pop, Bollywood Marquee |

Names and colours are original. Hindi-first templates use larger sizes and fewer words per group tuned for Devanagari.

### Devanagari font selection
- `CaptionStyle.devanagariFont` (in `packages/types/src/caption.ts`) widens from the literal `'Noto Sans Devanagari'` to the bundled Devanagari-capable font names.
- `captionFont()` in `packages/captions/src/presentation.ts` uses `style.devanagariFont ?? 'Noto Sans Devanagari'` for Devanagari text instead of always forcing Noto. Browser overlay and ASS export both call it.
- `validateDocument` replaces the hard-coded font lists with one shared allowlist exported from `packages/captions` (bundled fonts plus the legacy system fonts Arial, Georgia, Impact). `fontWeight` stays `400 | 700`.

## 2. Fonts and gallery

### Bundled fonts
Static TTF, SIL OFL, from Google Fonts, stored in `apps/web/public/fonts` with their licence files (already used by FFmpeg `fontsdir` and the web `@font-face` rules).

| Family | Weights | Scripts | Use |
|---|---|---|---|
| Poppins | 400, 700 | Latin + Devanagari | bold, gaming, hindi |
| Baloo 2 | 700 | Latin + Devanagari | playful pop (Desi Pop) |
| Rozha One | 400 | Latin + Devanagari serif | luxury, Bollywood Marquee |
| Teko | 700 | Latin + Devanagari condensed | gaming/sports headlines |
| Playfair Display | 700 | Latin | Gold Serif (Devanagari falls back to Rozha One) |

- Estimated added size: 2–3 MB. Browser loads a font only when a template uses it (`font-display: block` + `document.fonts.load`).
- `assFontSize()` gets a measured cell-to-em ratio per font. A one-off fontTools script measures OS/2 metrics; values are hard-coded with a comment naming the source file.
- Attribution in `THIRD_PARTY_NOTICES.md` and `assets/caption-templates/README.md`.

### Gallery UI
Component: `apps/web/components/caption-templates.tsx` (`TemplateGallery`), used on the upload page and in Caption studio.

- Category chips (All, Bold, Minimal, Podcast, Gaming, Luxury, Hindi, My templates) as an accessible radio group.
- Search over name, tags and category. Result count announced in a live region. Empty state with "Clear filters".
- Sample-script switch: Hinglish "Aaj kuch naya", Hindi "आज कुछ नया", English sample.
- Animated previews run only for tiles in the viewport (IntersectionObserver). Reduced-motion preference respected as today.
- Browser-saved custom templates appear under "My templates".
- Last category remembered in `localStorage`, wrapped in try/catch.

## 3. Testing and production grade

### Tests
1. Catalogue (`packages/captions/test/templates.test.ts`): unique IDs; valid category; non-empty tags; name ≤ 40 chars; every style passes `validateDocument`; every font is bundled and has an `assFontSize` entry; all 18 legacy IDs still present.
2. Script coverage: each template run through `wordPresentation`, `fitCaptionStyle` and `buildAss` with Roman, mixed and Devanagari lines at 9:16, 16:9 and 1:1. Devanagari words resolve to the template's Devanagari font; lines fit inside the frame.
3. Render check (separate, slower command): 2-second FFmpeg export per template × 3 scripts. Browser screenshot vs exported frame compared on caption bounding box position and size within a tolerance. Contact sheets written to `artifacts/`.
4. Browser regression (`apps/web/test/browser.mjs`): chips, search, empty state, script switch, selection persists after reload, My templates, keyboard operation of chips.

### Production grade
- Worker verifies bundled font files at startup and before each caption export; a missing file fails the job with a clear message naming the font. No silent fallback.
- Documents referencing an unknown template ID keep their saved style and show "Custom (legacy)"; no error.
- `parseCustomTemplate` rejects fonts outside the allowlist, so imported JSON cannot select arbitrary system fonts.

## Acceptance criteria
- ≥ 40 templates across six categories, all original.
- All new and existing TypeScript tests, root typecheck, web production build and browser regression pass.
- Render check passes for every template × script; contact sheets reviewed by the user.
- Existing projects and saved custom templates open with unchanged appearance.

## Risks
- libass and browser glyph shaping can differ for some Devanagari conjuncts in display fonts; the render check catches this per font, and a font that fails is dropped rather than patched.
- Display fonts vary in width; `fitCaptionStyle` width estimates may need a per-font factor.
