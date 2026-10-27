# Caption Accuracy — Design (Sub-project B)

Date: 2026-10-21 · Status: approved, ON HOLD (waiting for more disk space)

## Goal
Make generated captions more accurate for Hinglish first, then Hindi and English, with tight word timing, running fully locally on the RTX 4060 (8 GB). Add Devanagari Hindi output. Prove improvements with a benchmark built from the user's own corrected videos, and harden the pipeline to production grade for single-machine local use (no login, billing or cloud services).

## Out of scope
- Cloud speech APIs and fine-tuning our own model.
- Free-form LLM rewriting of recognised text (previously tried and discarded because it invents words).
- New database tables or columns. New data lives in existing JSON fields or storage files.
- Changes to the template library (sub-project A).

## Facts this design relies on
- Recognition: Faster Whisper 1.2.1 / CTranslate2 4.8.2, model `dropbox-dash/faster-whisper-large-v3-turbo`, currently CPU INT8 (`transcribe-local.py` uses `int8_float16` on CUDA). Silero VAD windows, WhisperX 3.8.6 alignment (English `facebook/wav2vec2-base-960h`, Hindi `theainerd/Wav2Vec2-large-xlsr-hindi`), Qwen 3.5 9B via Ollama for Hinglish Romanization with `keep_alive: '5m'`.
- `ctranslate2.get_cuda_device_count()` returns 1; PyTorch is `2.8.0+cpu`; NVIDIA driver 616.56.
- `TranscriptWord.confidence` already stores word probability. Per-word timing source (`aligned` / `native`) exists in provider output but is not persisted per word.
- `CaptionOutput = 'hinglish' | 'english'` in `packages/types/src/generation.ts`.
- `local-transcription.ts` uses a flat 60-minute timeout and keeps the last 500 chars of stderr.
- The worker has no recovery for jobs interrupted mid-processing.
- Reference videos: 0907 (78 s, Hinglish), Asus laptop (60 s, Hinglish), Minecraft (127 s, Hinglish), 0929 (11 s, English) — about 4.6 minutes.

## 1. Accuracy benchmark
- Caption studio gets a **"Save as accuracy reference"** button. It stores the current saved caption document's words and timings as `users/{userId}/benchmarks/{videoId}.json` through a user-scoped API route (ownership checked, same storage abstraction and key prefix rules). JSON contains `videoId`, `savedAt`, `outputLanguage`, `words: {text, start, end}[]`. Saving again replaces it.
- `npm run bench:asr` (new script in `apps/worker`) runs the local provider on each reference video's existing extracted audio with one configuration (`--model`, `--device`, `--alignment`, `--preprocess`, `--corrections`, `--beam`), defaults from `.env`.
- Normalisation before scoring: lowercase, strip punctuation, Devanagari → Roman via the existing rules romanizer, merge spelling variants from an editable list `packages/ai/scripts/bench_variants.json` (e.g. nahi/nahin, hai/he).
- Metrics per video and overall: WER (primary), CER, word-start timing error median and p90 in ms for matched words, real-time factor.
- Output: printed table + `artifacts/asr-bench/<YYYY-MM-DD>-<config-slug>.json`.
- A baseline run with today's configuration happens before any other change.
- Limit stated in every report: 4 videos / ~4.6 minutes is a regression and model-selection set, not a general accuracy claim.

## 2. GPU and model selection
- Setup: `infra/scripts/setup-local-transcription.ps1 -Gpu` installs `torch`/`torchaudio` 2.8.0 CUDA 12.6 builds into `.venv-whisper`. ctranslate2 first tries the CUDA DLLs shipped with PyTorch; only if that fails does setup add `nvidia-cublas-cu12` and `nvidia-cudnn-cu12`. Pins recorded in `requirements-windows-cuda.lock.txt`. Downloads happen only in setup, never in a job.
- Estimated downloads: GPU libraries ~2.6–3.8 GB; `large-v3` model ~3.1 GB; up to two Hindi-tuned candidates ~1.5–3.1 GB each. Losing candidates are deleted after selection.
- `LOCAL_TRANSCRIPTION_DEVICE` accepts `cpu | cuda | auto` (`auto` = CUDA when it initialises, else CPU). CUDA uses `float16`. Alignment runs on the same device.
- GPU memory: before recognition the worker asks Ollama to unload Qwen (`keep_alive: 0`); the Python process exits after recognition; Qwen requests use `keep_alive: 0`.
- Candidates: current `large-v3-turbo`, `large-v3`, up to two public Hindi-tuned Whisper checkpoints with MIT or Apache-2.0 licences (converted to CTranslate2; unclear licence = skipped).
- Selection rule: lowest WER on the three Hinglish references; English WER on 0929 not worse than baseline by more than 2 points; GPU real-time factor ≤ 0.5. Winner becomes the `.env` default.
- Beam size, VAD window length and `ASR_AUDIO_PREPROCESS` are tuned the same way; a change is kept only if it measurably helps.

## 3. Correction and Devanagari output

### Correction
- Keep vocabulary decoder prompts and the existing CTC-verified phonetic corrections; benchmark them on/off and keep them only if WER improves.
- Persist per-word timing source: provider diagnostics in `Transcript.data` gain `estimatedTiming: number[]` (transcript word indexes whose timing is not aligned).
- **Uncertain-words review** in Caption studio: a caption word is uncertain when its matching transcript word (by time overlap) has `confidence < 0.5` or estimated timing. Uncertain words are underlined; a "Review N uncertain words" control steps through them, seeking and playing each. Keyboard accessible.
- Optional experiment, off by default: constrained Qwen context pass that may change only low-confidence words, only to a sound-alike or vocabulary entry. Adopted only if the benchmark shows lower WER and zero inserted words not in the audio-aligned candidate set; otherwise removed.

### Devanagari Hindi
- `CaptionOutput` becomes `'hinglish' | 'hindi' | 'english'`; upload and regeneration offer "Hindi (Devanagari)".
- Hindi uses the same per-window Hindi/English recognition as Hinglish and skips Qwen Romanization. Hindi words stay Devanagari, English words stay Latin.
- Caption studio script switch "Hinglish | हिंदी": rebuilds caption words from the saved transcript, keeping timing, grouping and style; no new transcription. Hinglish → हिंदी is immediate; हिंदी → Hinglish runs Romanization as a short background job with progress. When caption text has been edited, a confirmation states edits will be replaced; Undo restores the previous document.

## 4. Production grade and testing

### Reliability
1. On worker startup, jobs in an active status (anything except `queued`, `completed`, `failed`) are marked `failed` with "Processing stopped because the worker restarted. Press Generate again." No automatic retry; existing captions/exports untouched.
2. Preflight before recognition: recognition and alignment models cached; Ollama reachable when Hinglish conversion is needed; CUDA initialises when device is `cuda`/`auto`. Each failure returns one actionable message.
3. GPU fallback: CUDA init failure or out-of-memory retries once on CPU; `Transcript.data` records the reason and the editor shows it.
4. Timeout = 3 × audio duration + 5 minutes, capped at 2 hours; stderr tail kept.
5. Stage progress messages: preparing audio, recognising (window n/N), aligning, converting to Hinglish.
6. A failed regeneration keeps previous captions and exports (regression test).

### Tests
- Python: normalisation and WER/CER on known pairs with exact expected values; device fallback selection.
- TypeScript: `parseGenerationOptions` with `hindi`; script switch preserves timing/style; uncertain-word detection; interrupted-job recovery; timeout formula; preflight messages; reference save/ownership.
- Browser: Hindi upload option; script switch with confirm and Undo; uncertain-words review; Save as accuracy reference.
- Benchmark results (baseline and after each change) recorded in `docs/tasks.md`.

## Acceptance criteria
- Hinglish WER on the three Hinglish references is lower than the recorded baseline; the real numbers are reported.
- English WER on 0929 not worse than baseline by more than 2 points.
- GPU real-time factor ≤ 0.5 for the selected model.
- All existing and new tests, root typecheck, isolated web build and browser regression pass.
- Existing projects open unchanged.

## Dependencies on the user
- Correct the captions of the four reference videos in Caption studio and press "Save as accuracy reference" (about 10–20 minutes per video) before model selection.

## Risks
- Hindi-tuned checkpoints may be unavailable with permissive licences or worse on code-switched speech; then selection is between turbo and large-v3.
- Four short videos can let a model win by chance; differences under ~2 WER points are treated as ties, preferring the faster model.
- ctranslate2 may not load PyTorch's CUDA DLLs on Windows, requiring the separate NVIDIA wheels (+~1.2 GB).
