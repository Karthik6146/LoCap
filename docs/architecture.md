# Architecture

## Stack
- npm-workspaces monorepo: `apps/*`, `packages/*`.
- Web: Next.js 14 App Router, React 18, TypeScript, Tailwind CSS.
- Worker: Node.js/tsx process with a Prisma-polled job queue.
- Data: Prisma Client with SQLite in `packages/database/prisma/schema.prisma`.
- Media: FFmpeg/ffprobe through `packages/video-engine`.
- Storage: `LocalStorage` or S3-compatible storage (MinIO/AWS/R2).
- AI: local Faster Whisper or API speech recognition; deterministic transcription is test-only. Other AI interfaces retain development providers.

## Main flow
1. Web upload routes validate input, create `Project`/`Video`/`RenderJob`, and write source media through `@clipx/storage`.
2. `apps/worker/src/index.ts` polls the oldest queued job every two seconds, claims it transactionally, and processes jobs serially.
3. `apps/worker/src/pipeline.ts` runs probe -> audio extraction -> transcription -> caption generation -> caption burn/upload. Clip analysis is a separate `analyze` job; rendering is a separate `render` job.
4. Prisma stores metadata, transcripts/words, captions, clips, exports, and job progress. Storage holds source, audio, proxy, and rendered files.
5. Web API routes read records scoped to the active user and stream/download files through storage.

## Modules
- `apps/web/app`: pages and route handlers for projects, uploads, jobs, clips, captions, transcripts, and exports.
- `apps/web/lib`: environment, session, API, and storage helpers.
- `apps/worker/src`: job entrypoint, pipeline stages, and progress updates.
- `packages/types`: shared domain and environment types.
- `packages/config`: upload/file validation and constants.
- `packages/video-engine`: probe, audio, cut, reframe, caption burn, and export operations.
- `packages/ai`: transcription/LLM contracts, dev providers, and external providers.
- `packages/captions`: caption generation, styles, editing, history, SRT/VTT, and burn groups.
- `packages/database`: Prisma client and schema.
- `packages/storage`: storage contract, local implementation, S3 implementation, and factory.
- `infra/docker-compose.yml`: optional PostgreSQL, Redis, and MinIO services.

## Common changes
- Add or change persisted entities: `packages/database/prisma/schema.prisma`, then run database generation/migration.
- Change an API workflow: the nearest `apps/web/app/api/**/route.ts`, plus its caller page.
- Change processing behavior: `apps/worker/src/pipeline.ts` and `packages/video-engine/src`.
- Change AI behavior/provider selection: `packages/ai/src/index.ts` and provider files.
- Change captions/styles: `packages/captions/src/engine.ts`, `styles.ts`, or `edit.ts`.
- Change storage paths/backends: `packages/storage/src`, `packages/config/src`, and the relevant API/worker caller.
- Change shared contracts: `packages/types/src` and all affected consumers.
- Change visual behavior: `apps/web/app/globals.css`, `apps/web/components/ui`, or the owning App Router page.

## Important caveats
- Database polling is the active queue; the unused BullMQ dependency was removed.
- Full-video captions use videoId with clipId null. Current subtitle downloads serialize saved rows; generation stores an immutable SRT file snapshot.
- Caption document saves use a hash revision and an ownership-scoped database transaction. Caption rendering snapshots the saved document in a type=caption RenderJob; the worker writes a unique export file at source resolution.
- Caption styles are stored in Caption.data; the original Transcript remains unchanged by editor corrections. No schema migration is required.
- The overview describes routes and packages that are absent from the current tree; source code is authoritative.

## Caption generation settings
- Shared `GenerationOptions` validates `outputLanguage` (hinglish/english) and the preset ID. Upload and regeneration persist these choices in RenderJob.input.
- English passes an English speech-recognition hint; Hinglish selects Hindi as the base recognition language for Hindi/English speech then converts Hindi tokens through local Qwen when AI_PROVIDER=ollama (otherwise the explicit Sanscript rules mode). This is not English translation. Raw Transcript/TranscriptWord rows remain unchanged by Romanization.
- Caption templates are shared in packages/captions; preset references and licenses are in assets/caption-templates. FFmpeg loads the same bundled Anton font as the web preview.

## Local speech accuracy/timing pipeline
- Worker extracts raw 16kHz mono, rejects silence, applies optional highpass/spectral denoise/loudnorm, then invokes the local Python provider with VAD-owned chunking rather than fixed ten-minute cuts.
- Python Silero boundaries include short context overlap. WhisperX aligns script-specific native Hindi/Latin runs with separate wav2vec2 models. Conflicting or unavailable word times are retained as explicit ASR fallbacks. Romanization follows alignment, never before it.
- Provider diagnostics persist in Transcript.data and surface as a timing-review note. Dependency/model installation is explicit; jobs use only cached models. Checkpoint and alignment model paths are environment-configurable. See docs/asr-pipeline.md.

Qwen conversion uses keyed single-token responses and preserves aligned source word IDs/times. Invalid output fails visibly. Transcript.data records conversion provider/model/version. Active ASR is turbo INT8 on CPU. Unused Redis/auth/billing environment stubs were removed; the database default matches the SQLite schema.
