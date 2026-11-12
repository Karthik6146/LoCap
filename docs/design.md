# Design System

## Direction
Unslop redesign (2026-11-13). Character: punchy, exact, quick; world: a night edit bay. Chrome is quiet graphite; color lives in the video thumbnails, the caption preview and the template cards. Each screen has one mint primary action. Signature: the lit active word (`.lit-word`, mint block with dark text, taken from the logo mark), used only on the logo, the active nav dot, the studio's current-word readout, the selected template and the launch hero headline.

`/` redirects to `/app`. The public launch page lives at `/launch` (motion set: HeroArt word field, HeroHeadline, TiltCard, ScriptTicker, scroll-drawn Pipeline, template autoplay, Reveal, FooterWordmark; all off under reduced motion) (`apps/web/app/launch`, sections in `apps/web/components/launch`). It is built only, never deployed, and uses synthetic demo content only.

## Tokens
Defined in `apps/web/app/globals.css` and mapped in `apps/web/tailwind.config.ts`:
- Graphite ramp: background `#111113`; surfaces `#18181b`, `#1f1f22`, `#29292d` (`surface`, `surface2`, `surface3`); hairline `rgb(237 237 240 / .08)`, strong hairline `/ .16`.
- Text roles: primary `#ededef`, secondary `#a1a1a8`, muted `#8a8a91`. Tailwind `gray-*` is remapped to this ramp, so `text-gray-100/400/500` are the three roles.
- Accent: mint `#06d6a0` (`primary`, supports alpha), hover `#34e2b5`, text on mint `#03241b`. Semantic: success `#4cc38a`, warning `#e5a43b`, error `#e5484d`; `red-300/400` are toned to match.
- Typography: Inter (interface) and Space Grotesk (titles) at weights 400–500, no bold headings, sentence case, tabular figures for counts, durations and timecodes.
- Radius: `rounded-lg` 8, `rounded-xl` 10 (controls), `rounded-2xl` 16 (cards, panels).
- Motion: one easing `cubic-bezier(0.22, 1, 0.36, 1)`, 120–500ms, transform and opacity only, one `.enter` fade-rise per page, all off under reduced motion.
- Shared classes: `.card`, `.btn`, `.btn-primary` (one per screen), `.btn-secondary`/`.btn-ghost`, `.btn-text`, `.input`, `.label`, `.kicker`, `.lit-word`, `.enter`.
- Icons: `lucide-react` at 16px (18 in navigation), stroke 1.5, text-role color. No emoji or text glyphs as icons. `components/launch/GithubMark.tsx` covers the GitHub brand mark that lucide v1 removed.
- Number tween: `CountUp` in `components/ui` (`motion/react`).
- Reference sources for components and motion: React Bits (True Focus, Count Up), Vengeance UI (Stagger Text), Skiper UI (player controls reference). Glow, aurora, spotlight and particle effects from these libraries are out of bounds.

## Components and layout
- Reusable primitives live in `apps/web/components/ui`.
- The authenticated shell is `apps/web/app/app/layout.tsx`; navigation covers Dashboard, Projects, Clips and Exports; the active item shows a small mint square.
- Pages use Tailwind `sm`, `md`, `lg`, and `xl` breakpoints. Upload supports drag/drop and file selection.
- Keep cards and controls aligned with the existing rounded, dark surface language unless intentionally redesigning the system.

## Project library and template gallery
- Dashboard and project library share a typed project card: a compact video poster, readable status, duration, truncated filename, edited date, an Open project link and a labelled trash button with deletion confirmation. The overview is capped at 1280px; cards use three desktop columns, two tablet columns and one phone column. The editor keeps its wider canvas.
- Overview counts include all owned projects, ready projects and completed exports. The inaccurate storage counter is removed. The library supports a user-scoped project-name search and clear empty states.
- The worker extracts a small JPEG poster through the existing FFmpeg/storage modules. Thumbnail failure does not stop transcription; missing posters use an explicit placeholder. Existing local videos were backfilled without ASR or caption changes.
- The gallery now offers 40 templates (the 18 original styles plus 22 new ones) with category chips, My templates, search, a preview-text switch and remembered category; see caption-templates.md. The original 18 styles remain available. Gallery cards measure their real width and scale the shared caption renderer around a centered mixed-script sample. Selection uses a mint border/checkmark and descriptive style names. Static typewriter samples show the completed words; motion previews are opt-in and disabled when reduced motion is requested.
- Design references inspected on 2026-10-13: [VEED's dashboard guide](https://support.veed.io/en/articles/11641509-how-veed-s-dashboard-works) for thumbnail cards and recents, [Kapwing's subtitle workflow](https://www.kapwing.com/help/add-captions/) for preview/customization, and [Submagic's custom-template guide](https://care.submagic.co/en/article/how-to-create-custom-template-in-submagic-v6g09s/) for visible style selection and saving. These informed original UI changes; no product code or reference assets are bundled.

## Accessibility requirements
- Preserve keyboard focus visibility and meaningful button/link labels.
- Keep reduced-motion behavior from `prefers-reduced-motion`.
- Provide useful `alt` text for thumbnails and media; avoid empty alternatives for informative images.
- Add live status announcements and focus management for upload, processing, modal, and error transitions.
- Mobile navigation applies state to visibility/transform, restores focus on close and supports Escape; desktop navigation remains visible.
- Verify contrast, keyboard navigation, touch targets, and responsive overflow when changing media/editor surfaces.

## Known gaps
- Accessibility semantics and focus management are incomplete.
- Some thumbnails use `alt=""`.
- Mobile navigation/editor are tested in Chromium at 390px; Safari/Firefox and screen-reader behavior remain **Unconfirmed**.
- No separate design-token documentation beyond the CSS/Tailwind sources is present.

## Caption studio
- Reference workflow: https://www.clucap.com/ - generation, correction, timing, styling, preview and export in one workspace. LoCap retains its own visual system and implementation.
- Desktop uses caption segments, a central source preview/playhead and an appearance panel with Templates/Customize controls. On mobile, style controls are collapsed behind an explicit button so corrections remain easier to reach.
- Save state and errors stay visible; exports require saved edits. SRT/VTT are text/timing files; MP4 burns the saved style.
- Supported shared effects: active-word pop, bounce, cumulative karaoke color, grapheme typewriter, fade, neon glow and marker highlight. Templates support bundled Montserrat/Noto Sans Devanagari; backgrounds are rectangular. Motion thumbnails are opt-in and respect reduced-motion preferences. See caption-templates.md.

- Generation starts with English/Hinglish radio cards and a six-preset visual gallery. Existing projects expose the same settings before regeneration.
- The shell uses rounded desktop navigation and a mobile drawer. Studio has a sticky save toolbar and a portrait preview capped at 560px high.
- Templates can be customized, saved in browser storage, exported/imported as validated JSON, and removed. The applied style is stored with the caption document. Anton is bundled under OFL and available in preview and export.

- Public Clucap visual reference was inspected on 2026-09-21: mint/black palette, rounded navigation and oversized typography. Its sign-in-only editor was not inspected. LoCap retains original copy and branding.

Caption rows support text search, original recognition disclosure and explicit Hindi-to-Hinglish conversion after correction. Active rows use an inset mint edge; search preserves document order.

- Creation now starts with Captioned video/SRT-only output cards; SRT hides irrelevant style controls. Video presets are behind a compact expandable style chooser. Studio uses quieter surfaces and visible sound controls with an extracted-audio fallback.

- Project detail previews preserve the video's intrinsic aspect ratio and are centered. Height is capped at 55svh/520px on mobile; desktop reserves 440px for the header and collapsed generation controls, with a 120–520px preview range. Expanded settings and short mobile pages still scroll normally; native playback/fullscreen controls remain available.

- Caption positioning uses direct mouse/touch dragging in the studio preview, with a Custom position hint below it and no placement presets or sliders. Pause on a caption and drag it; arrow keys nudge by 1% (Shift: 5%). Dragging preserves the grab offset, stays inside the video, pauses playback, and creates one undo step; cancelled gestures restore the prior placement. Validated normalized X/Y coordinates use the shared browser/ASS renderer and keep old styles compatible. Placement applies to all captions through Save changes and a new MP4 export; the project preview remains the initial generated snapshot.

