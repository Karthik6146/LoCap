# Caption Accuracy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Measurably more accurate Hinglish/Hindi/English captions on the local RTX 4060, Devanagari Hindi output, and a production-grade local pipeline.

**Architecture:** A benchmark (Python scoring + TS runner) scores the existing local provider against user-corrected references. The provider gains `auto`/CUDA float16 with CPU fallback; models are chosen by benchmark. Hindi output and an editor script switch reuse saved transcripts. Worker gains preflight, interrupted-job recovery and duration-based timeouts.

**Tech Stack:** TypeScript, Next.js 14, Prisma/SQLite, Node worker, Python 3.11 (`.venv-whisper`), faster-whisper 1.2.1 / CTranslate2 4.8.2, WhisperX 3.8.6, PyTorch 2.8.0 (CUDA 12.6), Ollama Qwen 3.5 9B, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-21-caption-accuracy-design.md`

## Global Constraints
- Everything runs locally; no cloud speech APIs, no login/billing.
- No new database tables or columns; new data goes in existing JSON fields or storage files under `users/{userId}/`.
- No free-form LLM rewriting of recognised text.
- Model/library downloads happen only in setup steps, never inside a job; jobs run with `HF_HUB_OFFLINE=1`.
- Downloads and installs (Tasks 5 and 6) require explicit user approval before running; stop and ask.
- User preference: ask before proceeding to each next stage.
- Not a git repository: "Checkpoint" means run the listed verification; no git commands.
- Preserve each file's existing line endings.
- Acceptance numbers: English WER ≤ baseline + 2 points; GPU real-time factor ≤ 0.5; WER differences < 2 points are ties (prefer faster model).

## Review Focus
1. Reference saved while the document has unsaved edits — must save the last saved document only, never unsaved browser state. Test in Task 2.
2. Hinglish → हिंदी switch after the user edited words — must confirm first and Undo must restore exactly. Test in Task 9.
3. CUDA initialises but runs out of memory mid-job — must retry once on CPU and record the reason, not fail silently or loop. Test in Task 4.
4. Worker restarted mid-job — job marked failed with the restart message; existing captions unchanged; queued jobs untouched. Test in Task 10.
5. Hindi output containing Latin English words — must pass the script guard (Devanagari + Latin allowed), while Hinglish/English guards stay strict. Test in Task 8.

---

### Task 1: Benchmark scoring core (Python)

**Files:**
- Create: `packages/ai/scripts/bench_score.py`, `packages/ai/scripts/bench_variants.json`, `packages/ai/scripts/test_bench_score.py`

**Interfaces:**
- Produces: `normalize(words: list[str], variants: dict[str, str]) -> list[str]` (lowercase, strip punctuation, Devanagari→Roman via the existing rules mapping used by `speech_normalization.py` if present there, else a minimal ITRANS-style table in this file, then variant merge); `wer(ref: list[str], hyp: list[str]) -> float`; `cer(ref: str, hyp: str) -> float`; `timing_errors(ref: list[dict], hyp: list[dict]) -> dict` returning `{ "matched": int, "medianMs": float, "p90Ms": float }` over words aligned by Levenshtein backtrace with equal normalised text. CLI: `python bench_score.py --ref ref.json --hyp hyp.json` prints one JSON object `{wer, cer, matched, medianMs, p90Ms}`.
- `bench_variants.json`: `{"nahin":"nahi","nhi":"nahi","he":"hai","hain":"hai","ki":"ki","kya":"kya","mai":"main","me":"mein","mei":"mein"}` (editable list; values are canonical).

- [ ] **Step 1: Failing tests** `test_bench_score.py` (unittest): `wer(['a','b','c'],['a','x','c']) == 1/3`; `wer([],[])==0`; `wer(['a'],[]) == 1.0`; `cer('abc','abd') == 1/3`; `normalize(['Nahin,','HAI!'], variants) == ['nahi','hai']`; `normalize(['आज'], {}) == ['aaj']`; timing: ref `[{text:'a',start:1.0},{text:'b',start:2.0}]`, hyp starts `1.1, 2.3` → matched 2, medianMs 200, p90Ms ≈ 290.
- [ ] **Step 2: Run, expect FAIL** — `.venv-whisper/Scripts/python.exe -I -m unittest packages/ai/scripts/test_bench_score.py` (run from repo root with `-I`; add the scripts dir to `sys.path` inside the test).
- [ ] **Step 3: Implement** with the standard library only.
- [ ] **Step 4: Run, expect PASS.**

### Task 2: Save as accuracy reference

**Files:**
- Create: `apps/web/app/api/captions/[videoId]/reference/route.ts`
- Modify: `apps/web/app/app/captions/[videoId]/editor.tsx`, `apps/web/test/browser.mjs`

**Interfaces:**
- Produces: `PUT /api/captions/{videoId}/reference` → `{ savedAt, words }`; stores JSON `{ videoId, savedAt, outputLanguage, words: {text,start,end}[] }` at key `users/{userId}/benchmarks/{videoId}.json` via `@clipx/storage`. Reads the **saved** caption rows (`clipId: null`) for a video owned by the current user (`getCurrentUser`); 404 otherwise; 400 when no captions.
- `outputLanguage` comes from `Transcript.data.outputLanguage`.

- [ ] **Step 1: Failing browser assertions:** button "Save as accuracy reference" is disabled while there are unsaved changes (title "Save changes first"); after saving, clicking it shows status "Saved as accuracy reference (N words)"; the stored JSON (read from the test's storage root) has N words equal to the saved document's words; a request for another user's video returns 404 (call the route with `AUTH_FORCE_USER` of a second fixture user or assert via a direct `fetch` against a video id not owned).
- [ ] **Step 2: Build and run, expect FAIL** (`NEXT_BUILD_DIR=.next-verify`, never `.next`).
- [ ] **Step 3: Implement** route and button (in the export section, ghost style).
- [ ] **Step 4: Run, expect PASS; delete `.next-verify`.**

### Task 3: Benchmark runner and baseline

**Files:**
- Create: `apps/worker/scripts/bench-asr.ts`
- Modify: `apps/worker/package.json` (script `"bench:asr": "tsx scripts/bench-asr.ts"`), root `package.json` (`"bench:asr": "npm run bench:asr -w @clipx/worker"`)

**Interfaces:**
- Consumes: Task 1 CLI, Task 2 reference files, `LocalTranscriptionProvider`, `loadEnv`, `getStorage`, `prisma`.
- Produces: CLI flags `--model --device (cpu|cuda|auto) --alignment (whisperx|native) --preprocess (true|false) --corrections (true|false) --beam N --only <videoId,...>`; defaults from `.env`. For each reference: locate the video's existing extracted audio (`Video.audioKey`, preprocessed exactly as `pipeline.ts` does when `--preprocess true`), run the provider with the reference's output language mapping (`english`→`en`, else `hi-latn`) and the project's saved vocabulary, write hyp/ref JSON to a temp dir, call `bench_score.py`, measure wall time. Print a table (video, words, WER, CER, median/p90 ms, RTF) plus overall (word-weighted WER) and write `artifacts/asr-bench/<YYYY-MM-DD>-<model-slug>-<device>.json` including config and per-video results. Exit 1 when no references exist with message "No accuracy references yet. Save one from Caption studio."

- [ ] **Step 1:** Unit test `apps/worker/test/bench-asr.test.ts` for the pure parts exported from the script module: flag parsing defaults/overrides, slug naming, word-weighted overall WER (`[{wer:.1,words:100},{wer:.3,words:300}]` → `.25`).
- [ ] **Step 2: Run, expect FAIL; implement; run, expect PASS** — `npm run test -w @clipx/worker`.
- [ ] **Step 3: User checkpoint.** Stop and ask the user to correct the four reference videos (0907, Asus, Minecraft, 0929) and press "Save as accuracy reference". Do not continue until confirmed.
- [ ] **Step 4: Baseline** — `npm run bench:asr` with current `.env` (turbo, CPU). Record the table in `docs/tasks.md` under "Caption accuracy baseline (date)".

### Task 4: Device auto, float16 and CPU fallback

**Files:**
- Modify: `packages/types/src/env.ts:30-33,72`, `packages/ai/scripts/transcribe-local.py`, `packages/ai/src/local-transcription.ts`
- Test: `packages/ai/test/local-transcription.test.ts` (create if absent), Python `packages/ai/scripts/test_speech_timing.py` style new test `test_device.py`

**Interfaces:**
- `Env.localTranscription.device: 'cpu' | 'cuda' | 'auto'` (`LOCAL_TRANSCRIPTION_DEVICE`, default `cpu`).
- Python: `resolve_device(requested: str, cuda_count: int) -> str` (`auto` → `cuda` if count > 0 else `cpu`); compute type `float16` on CUDA, `int8` on CPU; alignment `load_align_model`/`align` use the resolved device; output diagnostics gain `device` and `computeType`.
- TS: `LocalTranscriptionProvider.transcribe` runs with the configured device; if it rejects and stderr matches `/CUDA|cuDNN|cublas|out of memory/i` and the device was not `cpu`, it retries once with `--device cpu` and sets `diagnostics.deviceFallback = '<first matching stderr line, ≤200 chars>'`. Timeout = `min(2h, 3 * audioDuration + 5min)` via exported `transcriptionTimeoutMs(durationSeconds: number): number`.

- [ ] **Step 1: Failing tests:** `resolve_device('auto',1)=='cuda'`, `('auto',0)=='cpu'`, `('cpu',1)=='cpu'`; `transcriptionTimeoutMs(60) === 8*60*1000`, `(10000) === 2*60*60*1000`; provider fallback test with a fake python executable (a small Node script passed as `config.python`) that fails with "CUDA out of memory" when `--device cuda` and prints valid JSON when `--device cpu` → resolves with `diagnostics.deviceFallback` containing "out of memory"; a non-CUDA error is not retried (Review Focus 3).
- [ ] **Step 2: Run, expect FAIL; implement; run, expect PASS** (`npm run test -w @clipx/ai`, Python unittest).
- [ ] **Step 3: Checkpoint** — `npm run typecheck`.

### Task 5: GPU setup and Qwen memory handoff (USER APPROVAL REQUIRED)

**Files:**
- Modify: `infra/scripts/setup-local-transcription.ps1` (`-Gpu` switch), `packages/ai/src/ollama-hinglish.ts:45` (`keep_alive: 0`)
- Create: `packages/ai/scripts/requirements-windows-cuda.lock.txt`, `packages/ai/src/ollama-unload.ts`
- Modify: `apps/worker/src/pipeline.ts` (call unload before transcription when `env.ollama` is set)

**Interfaces:**
- `unloadOllama(config): Promise<void>` posts `{ model, keep_alive: 0 }` to `/api/generate`; network errors are ignored with a console warning (Ollama may be stopped).
- `-Gpu`: installs `torch==2.8.0` and `torchaudio==2.8.0` from `https://download.pytorch.org/whl/cu126`; then runs a check `python -I -c "import ctranslate2, torch; ..."` that loads a tiny CT2 CUDA op; only if it fails, installs `nvidia-cublas-cu12` and `nvidia-cudnn-cu12` (versions pinned in the lock). Writes the lock with `pip freeze`.

- [ ] **Step 1: Test** `unloadOllama` against a local HTTP stub: sends `keep_alive: 0`; resolves when the server is down. Hinglish converter request body has `keep_alive: 0`.
- [ ] **Step 2: Implement script/code changes (no install yet).**
- [ ] **Step 3: User checkpoint.** Show the exact pip commands and expected download size (~2.6–3.8 GB); install only after approval. Then set `LOCAL_TRANSCRIPTION_DEVICE=auto` in root `.env` and verify the worker log shows `device=cuda`.
- [ ] **Step 4: Benchmark** turbo on GPU (`npm run bench:asr -- --device cuda`) and record RTF.

### Task 6: Model candidates and selection (USER APPROVAL REQUIRED)

**Files:**
- Modify: `infra/scripts/setup-local-transcription.ps1` (`-Model` accepts candidate ids), `.env` (winner), `docs/asr-pipeline.md`

- [ ] **Step 1: Shortlist.** Find up to two Hindi-tuned Whisper checkpoints on Hugging Face with MIT or Apache-2.0 licences and a CTranslate2 conversion path; record name, licence, size. Skip any without a clear licence.
- [ ] **Step 2: User checkpoint.** Show the list with sizes (`large-v3` ~3.1 GB + candidates); download/convert only after approval into `.models/whisper`.
- [ ] **Step 3: Benchmark matrix** on GPU: each model × `--corrections true|false`; then for the leading model: `--beam 1|5`, `--preprocess true|false`. Save all artifact JSONs.
- [ ] **Step 4: Select** by the spec rule (Hinglish WER lowest, English ≤ baseline + 2, RTF ≤ 0.5, < 2-point differences are ties → faster). Update `.env` and `docs/asr-pipeline.md`; delete losing model directories after user confirms.

### Task 7: Uncertain-words review

**Files:**
- Modify: `packages/ai/scripts/transcribe-local.py` (diagnostics `estimatedTiming: number[]` = indexes with `timingSource != 'aligned'`), `apps/web/app/app/captions/[videoId]/page.tsx` (pass `uncertain` ranges), `apps/web/app/app/captions/[videoId]/editor.tsx`, `apps/web/app/globals.css`
- Create: `packages/captions/src/uncertain.ts` + `packages/captions/test/uncertain.test.ts`

**Interfaces:**
- `uncertainWordIds(captions: Caption[], transcriptWords: {start:number; end:number; confidence:number}[], estimated: number[], threshold = 0.5): Set<string>` — a caption word is uncertain if the transcript word with the largest time overlap has `confidence < threshold` or its index is in `estimated`.
- Editor: uncertain words get class `is-uncertain` (dotted underline, colour ≠ only cue: also `title="Check this word"`). Toolbar button "Review N uncertain words" (hidden when N = 0) steps to the next uncertain word: selects its segment, seeks to its start and plays to its end; Shift+click goes back.

- [ ] **Step 1: Failing unit tests** for overlap matching, threshold boundary (0.5 not uncertain, 0.49 uncertain), estimated-index rule, empty inputs.
- [ ] **Step 2: Failing browser assertions:** fixture transcript with one word at confidence 0.3 → button reads "Review 1 uncertain word", click selects that segment and seeks to the word start.
- [ ] **Step 3: Implement; run unit + browser, expect PASS.**

### Task 8: Hindi (Devanagari) output

**Files:**
- Modify: `packages/types/src/generation.ts`, `apps/worker/src/pipeline.ts:90,123-138`, `packages/ai/src/local-transcription.ts` (language guard), `apps/web/components/generation-options.tsx`, `apps/web/test/browser.mjs`
- Test: `packages/captions/test/presentation.test.ts` or new `packages/types` test location used by existing generation tests; `apps/worker/test/caption-flow.test.ts`

**Interfaces:**
- `CaptionOutput = 'hinglish' | 'hindi' | 'english'`; `parseGenerationOptions` accepts `hindi` (error text becomes "Choose English, Hinglish or Hindi captions.").
- Pipeline: `hindi` uses recognition language `hi-latn` (same per-window Hindi/English), skips `convertTranscriptToHinglish`, caption script guard allows Devanagari + Latin for `hindi` only; `conversion.provider = 'none'`; `script = 'mixed'`.
- Upload UI: third choice "Hindi (Devanagari)".

- [ ] **Step 1: Failing tests:** options parse; worker caption-flow test with a fake provider returning `['आज','website','बनाते']` → captions keep Devanagari + Latin for `hindi`, while `hinglish` path still converts and `english` path still rejects Devanagari (Review Focus 5); browser: Hindi option selectable and persisted in `RenderJob.input`.
- [ ] **Step 2: Implement; run, expect PASS.**

### Task 9: Script switch in Caption studio

**Files:**
- Create: `apps/web/app/api/captions/[videoId]/script/route.ts`, `packages/captions/src/rescript.ts` + test
- Modify: `apps/worker/src/pipeline.ts` (job type `script`), `apps/worker/src/index.ts` (dispatch), `apps/web/app/app/captions/[videoId]/editor.tsx`, `apps/web/test/browser.mjs`

**Interfaces:**
- `rescriptCaptions(captions: Caption[], words: {id?:string; text:string; start:number; end:number}[]): Caption[]` — replaces each caption word's text with the transcript word of largest time overlap, keeps caption ids, start/end, grouping and style; captions with no overlapping words are kept unchanged.
- `POST /api/captions/{videoId}/script` body `{ script: 'hindi' | 'hinglish', revision }`: `hindi` → synchronous: builds document from native transcript words via `rescriptCaptions`, saves with revision check, returns `{ document, revision }`. `hinglish` → enqueues `RenderJob` type `script` (input `{ revision }`), returns `{ jobId }`; worker converts transcript words with `convertTranscriptToHinglish`, applies `rescriptCaptions`, saves only if the revision still matches (else fails with "Captions changed while converting; try again").
- Editor: control "Script: Hinglish | हिंदी" (radio group, reuse the `RadioChips` helper from `caption-templates.tsx`). Every switch shows the confirm "Your text edits will be replaced. Timing and style are kept." (Hinglish text is not stored separately, so edited-vs-generated cannot be detected reliably; Undo is the safety net). Requires saved changes first (same rule as export). Undo restores the previous document (push to history before applying).

- [ ] **Step 1: Failing unit tests** for `rescriptCaptions` (overlap choice, unchanged when no overlap, ids/timing/style preserved).
- [ ] **Step 2: Failing browser assertions:** switch to हिंदी → first caption shows Devanagari from fixture transcript; Undo restores Roman text exactly (Review Focus 2); switch back to Hinglish shows progress then Roman text; cancelling the confirm leaves text unchanged.
- [ ] **Step 3: Implement; run, expect PASS.**

### Task 10: Production guards

**Files:**
- Modify: `apps/worker/src/index.ts` (startup recovery), `apps/worker/src/pipeline.ts` (preflight + progress messages), `apps/worker/src/transcribe-audio.ts`
- Create: `apps/worker/src/preflight.ts`
- Test: `apps/worker/test/recovery.test.ts`, `apps/worker/test/preflight.test.ts`, extend `caption-flow.test.ts`

**Interfaces:**
- `recoverInterruptedJobs(db): Promise<number>` — `status NOT IN ('queued','completed','failed')` → `failed`, `error = 'Processing stopped because the worker restarted. Press Generate again.'`; returns count; called once in `main()` before polling.
- `preflightTranscription(env, opts: { needsOllama: boolean }): Promise<void>` — throws one of: `Speech model <name> is not downloaded. Run infra/scripts/setup-local-transcription.ps1.`; `Alignment model for <lang> is not downloaded...`; `Ollama is not reachable at <url>. Start Ollama or choose English/Hindi output.` (Model presence check: `.models/whisper` contains the model dir, or the configured path exists.)
- Progress messages: `Preparing audio`, `Recognising speech`, `Aligning words`, `Converting to Hinglish`, `Generating captions` with existing progress numbers.

- [ ] **Step 1: Failing tests:** recovery marks only active statuses and leaves captions rows unchanged (Review Focus 4); preflight messages for each failure (temp dirs, stub Ollama URL); a provider error during regeneration leaves previous captions intact (existing behaviour, new regression test).
- [ ] **Step 2: Implement; run `npm run test -w @clipx/worker`, expect PASS.**

### Task 11: Constrained context-correction experiment (optional, benchmark-gated)

**Files:**
- Create: `packages/ai/src/ollama-correction.ts` + test; flag `ASR_CONTEXT_CORRECTION=true|false` (default false) in `env.ts`

**Interfaces:**
- `proposeContextCorrections(words, vocabulary, config): Promise<{index:number; from:string; to:string}[]>` — only words with `confidence < 0.5`; allowed replacements: vocabulary entries or candidates whose `phonetic_key` (from `speech_normalization.py`, exposed via a small Python CLI if needed) equals the original's; any other output is discarded.

- [ ] **Step 1: Tests:** outputs outside the allowed set are dropped; high-confidence words never change.
- [ ] **Step 2: Benchmark** best config with flag on/off. Keep only if Hinglish WER drops ≥ 1 point and no inserted words; otherwise delete the module and flag, and record the result.

### Task 12: Documentation and final verification

**Files:**
- Modify: `docs/asr-pipeline.md`, `docs/tasks.md`, `docs/memory.md`, `docs/architecture.md` (device/auto, Hindi output, benchmark)

- [ ] **Step 1:** Document setup (`-Gpu`), `LOCAL_TRANSCRIPTION_DEVICE=auto`, selected model and why, benchmark usage and limits, Hindi output, script switch, uncertain review, recovery/preflight.
- [ ] **Step 2:** Record baseline vs final benchmark tables in `docs/tasks.md`.
- [ ] **Step 3: Final verification** — `npm run test`, `npm run typecheck`, Python unittests, isolated `next build`, `test:browser`, `test:render`, `npm run bench:asr`; open an existing project in the dev server.
