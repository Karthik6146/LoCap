# Local speech pipeline: implementation walkthrough

Current verified setup (2026-09-29): CPU INT8 large-v3-turbo ASR, WhisperX alignment, then local Qwen3.5-9B. Small-model examples below are optional lightweight setup instructions; its old checkpoint was removed. Qwen uses keyed single-token mappings and rejects invalid output, preserving source timings. It cannot guarantee repair of misrecognized speech. See docs/tasks.md for verification and remaining limits.

LoCap already used faster-whisper 1.2.1, CPU INT8 and its built-in Silero VAD before this upgrade. The new work makes VAD chunking explicit, adds speech cleanup and wav2vec2 forced alignment, and keeps original video timestamps throughout. Switching inference engines alone does not repair misrecognized speech. INT8 is a speed/memory tradeoff; identical accuracy on every clip is not guaranteed.

## 1. Faster Whisper + VAD first

Use Python 3.11.9. From the repository root on Windows:

```powershell
powershell -File infra/scripts/setup-local-transcription.ps1 -Model small
```

The ASR requirements are pinned in `packages/ai/scripts/requirements-local.txt`:

| Library | Version | Purpose |
| --- | --- | --- |
| faster-whisper | 1.2.1 | Whisper inference and bundled Silero VAD |
| ctranslate2 | 4.8.2 | Quantized model runtime |
| onnxruntime | 1.30.0 | Silero inference |
| av | 18.1.0 | Audio decoding |

Root `.env` settings for the lightweight first stage:

```dotenv
TRANSCRIPTION_PROVIDER=local
LOCAL_TRANSCRIPTION_MODEL=small
LOCAL_TRANSCRIPTION_DEVICE=cpu
LOCAL_TRANSCRIPTION_ALIGNMENT=native
ASR_AUDIO_PREPROCESS=true
```

`packages/ai/scripts/transcribe-local.py` creates the model with `compute_type='int8'` on CPU and `int8_float16` on CUDA. It uses beam size 5, temperature 0 and `condition_on_previous_text=False`. CUDA also requires compatible NVIDIA libraries; this machine's verified configuration uses CPU.

The important VAD code is:

```python
max_chunk_seconds = 12 if args.language == 'auto' else 28
spans = get_speech_timestamps(audio, VadOptions(
    threshold=0.5,
    min_speech_duration_ms=160,
    min_silence_duration_ms=350,
    speech_pad_ms=200,
    max_speech_duration_s=max_chunk_seconds,
))
windows = speech_windows(spans, len(audio), max_seconds=max_chunk_seconds)
```

The Silero pass happens **before** recognition. The subsequent `model.transcribe` uses `vad_filter=False` because its input was already selected by Silero, not because VAD is disabled. Entirely silent audio returns no words. VAD is not a perfect music/speech classifier; voices in music can still be detected.

## 2. Prepare audio without changing the source clock

`packages/video-engine/src/audio.ts` adds `preprocessSpeechAudio`. The worker extracts raw 16kHz mono PCM, checks for silence, then applies:

```text
highpass=f=70,afftdn=nr=8:nf=-35,loudnorm=I=-20:TP=-2:LRA=11
```

This uses FFmpeg spectral denoising, not RNNoise. Output is resampled to 16kHz mono PCM. It does not trim, concatenate silence or time-stretch the source video. The original media/audio track used for export is untouched. `ASR_AUDIO_PREPROCESS=false` gives an A/B comparison; denoising can remove useful speech cues in some recordings, so it is deliberately mild.

## 3. Replace ASR estimates with wav2vec2 alignment

```powershell
powershell -File infra/scripts/setup-local-transcription.ps1 -Model small -WithAlignment
```

Additional pins in `requirements-alignment.txt`:

| Library | Version |
| --- | --- |
| whisperx | 3.8.6 |
| torch / torchaudio | 2.8.0 (CPU wheels installed as 2.8.0+cpu) |
| torchvision | 0.23.0 (CPU wheel) |
| transformers | 4.57.6 |
| huggingface-hub | 0.36.0 |

The complete installed Windows/CPU dependency snapshot is `requirements-windows-cpu.lock.txt`; install CPU PyTorch first with the setup script before using that lock. The alignment extra includes WhisperX's declared dependencies, but this pipeline does not load diarization or request a Hugging Face token.

Setup caches both models and NLTK sentence data under `.models/`:

- English: `facebook/wav2vec2-base-960h`
- Hindi: `theainerd/Wav2Vec2-large-xlsr-hindi`

Then set `LOCAL_TRANSCRIPTION_ALIGNMENT=whisperx` in the root `.env` and restart the worker (`npm run dev:worker`, or restart your combined `npm run dev` process).

The essential integration is:

```python
aligner, metadata = load_align_model(
    language, 'cpu', model_name=model_name,
    model_dir=alignment_cache, model_cache_only=True,
)
aligned = align(
    [coarse_segment], aligner, metadata, chunk_audio, 'cpu',
    interpolate_method='ignore', return_char_alignments=False,
)
```

Hindi and Latin word runs use their respective CTC models, on the **native transcript before Romanization**. Native word timings supply coarse acoustic windows only. Missing models fail clearly. Missing/low-score/overlapping CTC results preserve the original ASR timings and count as review-required fallbacks; they are never reported as successfully aligned. Numbers, unfamiliar names, fast code switches and overlapping speakers can require review. Alignment cannot correct wrong recognized words.

Model loading is offline for user jobs. Downloads happen only through the explicit setup flags. `LOCAL_ALIGNMENT_MODEL_EN` and `LOCAL_ALIGNMENT_MODEL_HI` can override the acoustic models, including local directories.

## 4. Consistent Hinglish after alignment

`packages/ai/src/hinglish.ts` applies Unicode normalization, familiar Hindi and borrowed-English spellings, Latin transliteration, ASCII digits and consistent punctuation. It preserves English tokens, word IDs and timestamps. Raw transcript rows remain native; generated captions use Roman Hinglish. This step is transliteration, not English translation or a correction model. Rare names may need manual spelling edits.

## 5. Speech boundaries for long videos

`apps/worker/src/transcribe-audio.ts` sends local audio to the Python provider without fixed ten-minute cuts. Hinglish selects Hindi or English independently per window; Urdu detection is routed to Hindi and unrestricted multilingual decoding is disabled. English mode keeps its explicit English hint. Recognition always uses `task='transcribe'`; Qwen Romanizes recognized Hindi afterward and preserves English words.

`speech_timing.py` packs VAD spans into windows of roughly 12 seconds for mixed speech (28 seconds for an explicit language), with 250ms context and absolute source timestamps. The shorter mixed-speech windows let language detection respond sooner to switches. Gaps longer than 600ms are not packed. Context around isolated speech is retained; overlapping context is divided between neighbors so quiet boundary words are not automatically discarded. Language switches within uninterrupted speech can still require review.

Silero tries to split long continuous speech at a pause. If there is no pause near the cap, a bounded split is unavoidable; overlap reduces the risk, and diagnostics request boundary review. This is not a guarantee that every sentence remains whole. The separate cloud provider retains its upload-size chunking; this upgrade targets the selected local pipeline.

## 6. Swap a fine-tuned checkpoint

No model is hard-coded into the provider. A fine-tuned Hugging Face Whisper checkpoint must first be converted into CTranslate2 format:

```powershell
.\.venv-whisper\Scripts\ct2-transformers-converter.exe `
  --model "path/to/your-finetuned-whisper" `
  --output_dir ".models/checkpoints/hinglish-ct2" `
  --copy_files tokenizer.json preprocessor_config.json `
  --quantization int8
```

```dotenv
LOCAL_TRANSCRIPTION_MODEL=.models/checkpoints/hinglish-ct2
```

Restart the worker after changing the setting. Use a Whisper-compatible checkpoint with tokenizer/preprocessor files and permitted usage terms. This adds checkpoint swapping, not training a new model. To choose a checkpoint responsibly, compare the same noisy/accented clips against hand-corrected transcripts and word boundary references. No WER or timing-error improvement is claimed without that ground truth.

## 7. Validation and UI

Run:

```powershell
.\.venv-whisper\Scripts\python.exe packages/ai/scripts/test_speech_timing.py
npm run test -w @clipx/ai
npm run test -w @clipx/worker
npm run test -w @clipx/video-engine
npm run typecheck
$env:NEXT_BUILD_DIR='.next-check'
npm run build:web
npm run test:browser -w @clipx/web
```

The UI uses an original LoCap mint/black design with rounded navigation and separate caption/preview/appearance panels. Timing provenance is shown as a concise review note. User text, custom styles, undo/redo, subtitle downloads and MP4 exports remain available.

References: [faster-whisper](https://github.com/SYSTRAN/faster-whisper), [WhisperX](https://github.com/m-bain/whisperX), [WhisperX alignment source](https://github.com/m-bain/whisperX/blob/v3.8.6/whisperx/alignment.py), [Clucap public site](https://www.clucap.com/).

## Hindi-first conversion review
See [repository research](caption-research.md). Hindi recognition and native-script alignment precede Romanization. The editor now exposes the original recognition and can Romanize manually corrected Hindi without changing word times. Whole-word spellings preserve English tokens. This does not repair incorrect recognition; accuracy on the reported clip still needs a reference transcript.


## Selected-language enforcement (2026-10-12)
Hinglish uses a local `hi-latn` recognition policy: each 12-second VAD window selects Hindi or English independently. Urdu detection is routed to Hindi, and unrestricted multilingual decoding is disabled to prevent script drift. English retains its explicit `en` lock. Remote Whisper receives `hi` for Hinglish because it accepts ISO source-language codes. Native Hindi/English words are aligned before Qwen Romanization. Unsupported scripts fail validation before caption replacement; they are never silently dropped. This constrains language/script selection, not word-for-word recognition accuracy.

## Vocabulary-guided recognition (2026-10-13)
Upload and regeneration offer **Names and phrases (optional)**. Enter up to 20 comma-separated phrases (80 characters / 5 words each), using standard English spellings for English terms and Devanagari for Hindi phrases. Use only phrases spoken in the video; context such as “पहली लिंक” is safer than an ambiguous standalone word. Hints are saved in pipeline job settings and restored on the project page.

The worker passes `vocabulary` to Faster Whisper's `initial_prompt` and `hotwords` on every VAD window. A window returning another script is retried once without hints; continued script drift fails without replacing captions. Hinglish permits both Hindi and Latin words regardless of which source language dominates the window. The API provider receives the same names as its transcription prompt. With local WhisperX enabled, `speech_normalization.py` proposes close consonant-based matches to supplied phrases. Exact matches reserve their source words; unrelated, confident, very short ambiguous and silence-separated phrases are preserved. Proposed changes require separate CTC timestamps/scores for every word, nearby acoustic bounds and no overlap. Rejected proposals restore all original words; no split-word timings are invented. Diagnostics retain vocabulary and accepted original/replacement text.

Hindi and English CTC runs now use nonoverlapping coarse windows, bounded by adjacent ASR words. Previously both models could align the same boundary audio, causing otherwise supported terms such as “Minecraft” and “search bar” to be rejected as overlaps. CTC still supplies the actual word timestamps inside each window. This conservatively depends on ASR's estimates at language boundaries; review unusually fast or unclear code switches.

This is a vocabulary-guided spelling heuristic, not an independent acoustic recognizer or a guarantee of correct wording. Forced alignment locates candidate words; it does not prove their meaning. Wrong hints can bias recognition. Free-form Qwen correction changed meaning during testing, so Qwen remains strictly Romanization-only. Existing captions must be regenerated to apply hints; downloaded exports remain snapshots. No new model or dependency is required.
