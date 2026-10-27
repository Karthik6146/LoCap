# Contextual ASR correction

Goal: improve phonetic errors in code-mixed Hindi/English using vocabulary-guided Faster Whisper and existing WhisperX, preserving real word times and correction provenance.

1. Inspect Test 6's saved recognition against the five user references. All are ASR errors; the Romanization-only adapter cannot fix a fused phrase.
2. Pass optional names/short phrases from upload/regeneration through validated generation options to decoder prompts/hotwords. Use the user's five Test 6 references as project-specific hints, not global replacements.
3. Propose close phonetic matches to hints before existing native-script alignment. Accept a changed phrase only when every word has CTC timing/score and no overlap. Restore all original words on rejection; record accepted original/replacement text in diagnostics.
4. Keep Qwen strictly Romanization-only. Free-form correction experiments changed meaning and are not included.
5. Test vocabulary validation/propagation, confident/unrelated phrases, silence boundaries, alignment rejection, fused-word timing and provider wiring. Run Python/AI/worker tests, typecheck and browser verification.
6. Back up SQLite, regenerate Test 6, compare each reference, verify SRT and MP4/audio, and document remaining recognition limitations. No commits or dependency additions.

Completed: all five reference terms verified in regenerated captions/SRT, and Minecraft/search-bar video frames inspected. Passed 26 Python tests, 69 TypeScript tests, typecheck, production web build and browser checks including saved-hint restoration. Temporary diagnostic scripts/data removed; retained original database backup `tmp/before-test6-vocabulary-1791845997129.db`. Full wording still needs human review; see docs/tasks.md.
