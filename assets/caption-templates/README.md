# Caption template test assets

Downloaded 2026-09-21 from https://github.com/sebetancurch/auto-caption:
- `upstream/styles.py`: original pop and karaoke preset definitions (reference data only; never executed).
- `upstream/LICENSE`: MIT license and original copyright notice.

LoCap Spotlight adapts the Anton typeface, white text, gold emphasis, outline and shadow. Fresh is a mint variation. These use LoCap's timed whole-word highlights, not the upstream scale-pop or karaoke sweep effects. Other templates are authored for LoCap.

Anton font downloaded from https://github.com/google/fonts/tree/main/ofl/anton into `apps/web/public/fonts`, alongside its OFL license. Browser previews and FFmpeg both load this bundled font.

Users can save, import and export custom template JSON in the caption studio. Saved templates are browser-local; the applied style is persisted with each caption document.

Poppins, Baloo 2, Rozha One, Teko and Playfair Display are distributed under the SIL Open Font License 1.1 (full notices in `apps/web/public/fonts/<Family>-OFL.txt`). Sources: https://github.com/google/fonts/tree/main/ofl/poppins, /baloo2, /rozhaone, /teko, /playfairdisplay. Baloo 2 and Teko are static Bold instances (wght=700) of the upstream variable fonts, made with `packages/ai/scripts/instance_font.py`. Playfair Display Bold is the unmodified upstream static TTF from v1.202 (https://github.com/clauseggers/Playfair, `fonts/TTF/PlayfairDisplay-Bold.ttf`), so its Reserved Font Name applies unchanged.
