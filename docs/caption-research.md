# Caption research â€” 2026-09-22

Source inspection, not an accuracy benchmark:

- [Caption AI transcriber](https://github.com/morningstarwebd/caption-ai/blob/main/ai_pipeline/transcriber.py) uses Groq whisper-large-v3, then optional rescue decoding. Its [Hindi normalizer](https://github.com/morningstarwebd/caption-ai/blob/main/ai_pipeline/hindi_normalizer.py) combines a dictionary with canonical spellings, followed elsewhere by LLM refinement. We did not adopt substring replacement (can corrupt longer Hindi words), rewriting English `me`/`to`, or choosing a transcript merely because it contains more words. These are not reliable correctness checks. Its API path is not offline.
- [HinglishMagic content.js](https://github.com/waleeddotdev/HinglishMagic/blob/main/content.js) sends existing Hindi captions to Gemini with instructions to preserve English and word counts. It does not recognize speech. LoCap preserves this useful distinction: Hindi recognition first, script conversion second, stable word timings. No extension code or API dependency was copied.
- [Indic-Subtitler experiment](https://github.com/kurianbenoy/Indic-Subtitler/blob/main/_experiments/test_faster_whisper.py) uses large-v3; its architecture supports alternative ASR models and WhisperX. LoCap already supports these backend concepts. Matching a backend does not establish equivalent accuracy.
- [Descript caption workflow](https://www.descript.com/subtitles) emphasizes editable text, preview and custom styling. LoCap's update emphasizes searchable text and original recognition beside corrections, retaining its own mint/black design.

## Changes

Expanded whole-token conversational Hindi and English-loanword spellings. Latin text is never globally rewritten. Original recognition is visible per caption using source time overlap; it remains immutable. Paste corrected Hindi into a caption, then use Convert Hindi to Hinglish. Conversion preserves current word IDs and timings; changing the number of words while editing still redistributes timing and needs review.

Search filters visible rows without changing order or deleting captions. Active rows have a clearer mint edge, quieter actions and distinct text fields. Original text and word controls remain keyboard-accessible disclosures.

## Accuracy limitations

Romanization cannot recover a word that ASR heard incorrectly. A dictionary is not a contextual language model. The current database had no transcript when this investigation ran, so the screenshot's original Hindi could not be inspected. No word-error-rate improvement is claimed. The source video and a corrected short transcript are needed to compare recognition models on the reported failure.

No API key is required by these changes. Cloud refinement is not enabled.

A local `dropbox-dash/faster-whisper-large-v3-turbo` download was attempted. Metadata downloaded but model weights remained at zero bytes for several minutes; the download was stopped. The installed small checkpoint remains selected. Retry with `.venv-whisper/Scripts/python.exe packages/ai/scripts/transcribe-local.py --model dropbox-dash/faster-whisper-large-v3-turbo --download`, then benchmark before changing `LOCAL_TRANSCRIPTION_MODEL`.

## Caption presets review — 2026-09-30
Public references: https://www.opus.pro/blog/best-caption-presets-styles-boost-retention and https://www.capcut.com/resource/caption-style . These describe bold emphasis, word-by-word/karaoke, minimal text and high-contrast styles for short-form video. They do not establish an independently measured Instagram/Shorts usage ranking. Added original Creator, Minimal, Rose and Contrast presets using existing licensed fonts and supported CSS/libass effects; no third-party template assets downloaded.

