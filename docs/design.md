# Design System

## Direction
The current UI is a dark, creator-focused dashboard for video work. It uses a compact application shell with a rounded desktop navigation, mobile drawer, sticky header, project/clip views, upload states, and media previews. There is a separate landing page at `/`.

## Tokens
Defined in `apps/web/app/globals.css` and Tailwind config:
- Background `#080c0b`; surfaces `#101715` and `#18221f`; border `#283730`.
- Primary mint `#06d6a0`; pale mint accent `#63f5c8`.
- Semantic colors: success `#22c55e`, warning `#f59e0b`, error `#ef4444`, muted `#9ca3af`.
- Typography: Inter for body and Space Grotesk for display headings, loaded by `apps/web/app/layout.tsx`.
- Shared classes include `.card`, `.btn`, `.btn-primary`, `.btn-ghost`, `.btn-accent`, `.input`, and `.label`.

## Components and layout
- Reusable primitives live in `apps/web/components/ui`.
- The authenticated shell is `apps/web/app/app/layout.tsx`; navigation currently covers Dashboard, Projects, AI Clips, and Exports.
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

