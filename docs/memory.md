# Project Memory

- LoCap is a TypeScript npm-workspaces monorepo for AI-assisted video clipping and captions. 
- The important runtime split is Next.js web/API plus a standalone worker. The worker currently polls Prisma every two seconds and processes one job at a time.
- Upload processing and clip analysis are intentionally separate: upload creates transcript/captions/proxy; an `analyze` job creates draft clips; a `render` job creates an export.
- Prisma currently uses SQLite. Docker Compose provisions PostgreSQL, Redis, and MinIO for future or optional deployments, so do not assume those services are active locally.
- Storage selection prefers reachable S3-compatible storage and falls back to local filesystem storage. Keep object keys user-scoped.
- Non-transcription AI factories use development providers without API keys. Speech transcription requires local Whisper or an API key; synthetic transcription is restricted to tests. FFmpeg/ffprobe are external runtime prerequisites.
- Current auth is a local-testing shortcut: `getCurrentUser()` uses `AUTH_FORCE_USER` or `demo@clipx.app`. Middleware does not enforce a real session.
- The old project overview overstates current auth, route, editor, and infrastructure readiness. Verify source before relying on it.
- Caption flow now persists video-associated captions and real SRT snapshots. Caption studio saves validated documents with revision checks and queues snapshot-based full-video exports. Mobile sidebar visibility and focus are wired and browser-tested.
- Local speech recognition uses Faster Whisper in `.venv-whisper`, cached models in `.models/whisper`, and `TRANSCRIPTION_PROVIDER=local`. The active multilingual large-v3-turbo model runs on CPU INT8. Generation offers Hinglish (Hindi in Roman letters plus English) or English speech recognition. Original transcript text is retained; Hinglish captions use local Qwen when AI_PROVIDER=ollama; Sanscript remains the explicit rules-only mode and editor utility. Missing setup fails clearly instead of producing sample captions.
- Caption exports preserve source dimensions. The shared presentation module drives eight animated templates in browser and libass; bundled Montserrat/Noto Devanagari font metrics are normalized for ASS. Minor raster/box/glow differences remain. See docs/caption-templates.md.
- Durable documentation belongs in these root files; `tasks.md` is the only running-status document.

- Worker commands start src/bootstrap.ts to load the root .env before Prisma/storage/providers initialize. Local storage without an explicit root resolves to the repository storage folder, independent of the application working directory.
- Dashboard and project listing expose deletion with ownership checks and confirmation; queued jobs are removed atomically. Active processing must finish before deletion.

- Caption templates include six editable presets, browser-local custom save/import/export, and a bundled OFL Anton font used by browser and FFmpeg. Downloaded MIT preset references/licenses live in assets/caption-templates.

- Speech upgrade: pinned Faster Whisper 1.2.1 / CTranslate2 4.8.2, CPU INT8 (CUDA int8_float16), explicit Silero speech windows, conservative FFmpeg cleanup, and optional WhisperX 3.8.6 English/Hindi CTC alignment before Romanization. Root .env now selects whisperx alignment with cached models; no API key is needed. Unalignable/conflicting words keep ASR timing and are counted for review.
- Exact installation/checkpoint-swap walkthrough: docs/asr-pipeline.md. Full tested Windows/CPU dependency lock: packages/ai/scripts/requirements-windows-cpu.lock.txt. Speech chunks retain absolute source offsets; the cloud fallback still uses upload-size chunks.

- 2026-09-22: Caption repository research is in docs/caption-research.md. Editor now exposes source recognition, searchable captions and explicit Hindi-to-Roman correction. AI regression 14 tests and browser checks passed. Large-v3-turbo weight download stalled; small remains selected. Recognition accuracy for the screenshot is unverified without the source clip.

- 2026-09-29: Qwen adapter now uses strict keyed single-token mapping; no fabricated timings or silent rules fallback. Local turbo ASR improved the supplied opening; full-video wording still needs review. Latest video regenerated. Ollama Qwen is installed in D:/AI/Models and reachable at localhost:11434.

- 2026-09-29 mixed speech fix: Hinglish selects automatic source recognition, with independent per-window language detection; mixed VAD windows target 12 seconds. As of 2026-10-12, Hinglish restricts detection to Hindi/English and disables unrestricted multilingual decoding. English retains its explicit hint. VAD padding ownership now retains quiet edge words without assigning overlap to both windows. Qwen remains transliteration-only. Regenerate older captions to apply.


- Generation supports optional outputMode=video|srt (default video). SRT-only skips the captioned MP4 render; text/timing remains editable and downloadable. Caption studio offers an extracted WAV audio fallback for original codecs a browser cannot decode. Ten bundled presets; four new styles are Creator, Minimal, Rose and Contrast.


- 2026-09-30: Eight configuration-driven animated templates reuse CaptionDocument, React preview and FFmpeg/libass export. Template/word-count edits preserve timed words and do not invoke ASR. Grapheme-safe typewriter, static Latin/Devanagari fonts, normalized placement and animation strength are shared. Legacy presets and custom JSON templates remain supported. MIT template-reference attribution is in THIRD_PARTY_NOTICES.md.

- 2026-10-12: Project moved to D:/Karthik Shakyawar/Development Porjects/Omniroute. Root and web .env use the same absolute SQLite path and updated local asset paths; update both after moving the folder.
- 2026-10-13: Upload/regeneration support optional vocabulary phrases, passed to local decoder prompts/hotwords and remote transcription prompts. Local phonetic proposals require CTC support and retain correction provenance. Hindi/English alignment windows no longer overlap at code switches; hinted script drift retries once without hints. Qwen remains Romanization-only. See docs/asr-pipeline.md for limits.
- 2026-10-14: Caption template library: 40 templates in categories; font registry in packages/captions/src/fonts.ts (bundled OFL fonts, missing files fail export/worker start); render check `test:render` with isolated NEXT_BUILD_DIR. See docs/caption-templates.md.
