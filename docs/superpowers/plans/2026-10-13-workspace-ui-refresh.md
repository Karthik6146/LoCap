# Workspace and caption-gallery refresh

Goal: replace oversized empty project cards and tiny template samples with a compact, readable dark workspace, preserving existing caption generation, dragging, saving, exports and deletion.

Status: implemented and verified. 77 tests, workspace typecheck, isolated production web build and expanded Chromium flow passed. Actual project posters and desktop/phone layouts inspected; six local videos backfilled without ASR. Lint remains blocked by absent ESLint configuration. Details and changed files: docs/tasks.md.

Architecture: Next.js/React, existing Tailwind/CSS tokens, Prisma-owned project queries, local/S3 storage, existing FFmpeg and CaptionOverlay. No dependencies, copied product assets, cloud services, migrations or commits.

References: VEED's official dashboard guide (thumbnail cards/recents), Kapwing's subtitle workflow (preview and customization), Submagic's official custom-template guide (choose a visible style, customize and save). These guide layout decisions; retain ClipX branding and original implementation.

## 1. Project surfaces and thumbnails
- Reuse one typed project-card component for dashboard and project library; compact thumbnails, readable status, duration/date, truncated filename and accessible deletion.
- Update dashboard header/statistics, project library search/empty states and scoped CSS. Keep the editor's wide layout and existing preview sizing.
- Add thumbnail extraction to the existing video-engine probe module and worker, using existing FFmpeg/storage with an optional failure fallback. Backfill owned missing thumbnails locally without ASR or changes to source video/captions.
- Check thumbnail JPEG output, ownership-prefix handling, very short clips, absent metadata, processing/draft/error states and long filenames. Verify real project navigation, search and deletion confirmation/cancellation.

## 2. Readable template previews
- Fix TemplateGallery's fixed 150px rendering canvas: measure the card and scale the existing CaptionOverlay to it. Use a short mixed-script sample, a legible font, clear selection markers and restrained visual backgrounds.
- Preserve all registry entries, animation opt-in, reduced-motion behavior, existing customization and custom save/import/export/remove. Display the current preset selection on initial load.
- Check centered preview geometry, Hindi graphemes, selection, animation/reduced motion and collapsed/expanded mobile styles.

## 3. Verification and documentation
- Run the affected worker regression and existing full tests, root typecheck, isolated production web build and expanded browser smoke test.
- Inspect dashboard/library/gallery on desktop and mobile against actual project data. Check horizontal overflow, thumbnails and keyboard/touch targets; verify drag/save/export still work.
- Update docs/design.md and docs/tasks.md with resulting behavior and limits. Remove temporary probes/reference assets. Do not commit.
