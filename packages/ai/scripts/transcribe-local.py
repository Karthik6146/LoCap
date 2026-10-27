"""Offline Faster Whisper + Silero VAD + optional WhisperX CTC alignment."""
import argparse
from contextlib import redirect_stdout
import json
import os
from pathlib import Path
import sys
from speech_timing import (SAMPLE_RATE, speech_windows, alignment_runs, alignment_window,
                           apply_alignment, restore_window_words,
                           transcribe_window)
from speech_normalization import propose_corrections, correction_candidates, accept_corrections

ROOT = Path(__file__).resolve().parents[3]
os.environ.setdefault('HF_HUB_DISABLE_SYMLINKS_WARNING', '1')
os.environ.setdefault('HF_HUB_DISABLE_TELEMETRY', '1')
os.environ.setdefault('HF_HUB_DISABLE_XET', '1')
os.environ['NLTK_DATA'] = str(ROOT / '.models' / 'nltk')
DEFAULT_ALIGN = {'en': 'facebook/wav2vec2-base-960h', 'hi': 'theainerd/Wav2Vec2-large-xlsr-hindi'}


def local_or_hub(value):
    candidate = ROOT / value
    return str(candidate.resolve()) if candidate.exists() else value


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--audio')
    parser.add_argument('--model', default='small')
    parser.add_argument('--language', default='auto')
    parser.add_argument('--device', default='cpu', choices=['cpu', 'cuda'])
    parser.add_argument('--alignment', default='native', choices=['native', 'whisperx'])
    parser.add_argument('--align-model-en', default=DEFAULT_ALIGN['en'])
    parser.add_argument('--align-model-hi', default=DEFAULT_ALIGN['hi'])
    parser.add_argument('--vocabulary', default='[]')
    parser.add_argument('--download', action='store_true')
    parser.add_argument('--download-alignment', action='store_true')
    args = parser.parse_args()
    vocabulary = json.loads(args.vocabulary)
    if (not isinstance(vocabulary, list) or len(vocabulary) > 20 or
            any(not isinstance(v, str) or not v.strip() or len(v) > 80 or len(v.split()) > 5
                or any(ord(c) < 32 for c in v) for v in vocabulary)):
        raise ValueError('Vocabulary must contain at most 20 short names or phrases.')
    alignment_models = {'en': args.align_model_en, 'hi': args.align_model_hi}
    cache = ROOT / '.models'
    aligners = {}

    def load_aligner(language, download=False):
        if language not in aligners:
            import torch
            from whisperx.alignment import load_align_model
            torch.set_num_threads(4)
            aligners[language] = load_align_model(language, 'cpu',
                model_name=local_or_hub(alignment_models[language]),
                model_dir=str(cache / 'alignment'), model_cache_only=not download)
        return aligners[language]

    if args.download_alignment:
        import nltk
        if not nltk.download('punkt_tab', download_dir=os.environ['NLTK_DATA'], quiet=True):
            raise RuntimeError('Could not install alignment sentence data.')
        for language in alignment_models:
            load_aligner(language, download=True)
        return {'installedAlignment': alignment_models}

    from faster_whisper import WhisperModel
    from faster_whisper.audio import decode_audio
    from faster_whisper.vad import get_speech_timestamps, VadOptions
    compute = 'int8' if args.device == 'cpu' else 'int8_float16'
    model = WhisperModel(local_or_hub(args.model), device=args.device,
        compute_type=compute, cpu_threads=4, download_root=str(cache / 'whisper'),
        local_files_only=not args.download)
    if args.download:
        return {'installed': args.model, 'computeType': compute}
    if not args.audio:
        raise ValueError('An audio file is required.')

    audio = decode_audio(args.audio, sampling_rate=SAMPLE_RATE)
    duration = len(audio) / SAMPLE_RATE
    # Silero prefers pauses. Overlapping context protects continuous speech
    # when no pause is available near the 28-second ASR context limit.
    mixed = args.language in ('auto', 'hi-latn')
    max_chunk_seconds = 12 if mixed else 28
    spans = get_speech_timestamps(audio, VadOptions(threshold=0.5,
        min_speech_duration_ms=160, min_silence_duration_ms=350,
        speech_pad_ms=200, max_speech_duration_s=max_chunk_seconds))
    windows = speech_windows(spans, len(audio), max_seconds=max_chunk_seconds)
    words, warnings, corrections = [], [], []
    language = None if mixed else args.language
    if args.alignment == 'whisperx' and windows:
        import nltk
        # Preflight prevents NLTK's internal lazy network download in user jobs.
        nltk.data.find('tokenizers/punkt_tab/english/')
        from whisperx.alignment import align

    for window in windows:
        chunk = audio[window['read_start']:window['read_end']]
        segments, info = transcribe_window(model, chunk, args.language, vocabulary)
        if language is None:
            language = info.language
        native = []
        for segment in segments:
            for word in segment.words or []:
                tokens = word.word.strip().split()
                start = max(native[-1]['end'] if native else 0, float(word.start))
                end = min(len(chunk) / SAMPLE_RATE, float(word.end))
                if not tokens or end <= start:
                    continue
                for i, token in enumerate(tokens):
                    native.append({'text': token, 'start': start + (end-start)*i/len(tokens),
                        'end': start + (end-start)*(i+1)/len(tokens),
                        'confidence': float(word.probability), 'timingSource': 'native'})
        for word in native:
            word['_nativeMidpoint'] = (word['start'] + word['end']) / 2
        proposals = {}
        if vocabulary and native and args.alignment == 'whisperx':
            ownership = ((window['own_start'] - window['read_start']) / SAMPLE_RATE,
                         (window['own_end'] - window['read_start']) / SAMPLE_RATE)
            proposals = propose_corrections(native, vocabulary, ownership)
        candidates = correction_candidates(native, proposals)
        candidate_words = list(candidates)
        if args.alignment == 'whisperx' and native:
            for run in alignment_runs(candidates):
                run_words = [candidates[i] for i in run['indices']]
                aligner, metadata = load_aligner(run['language'])
                # Native times select only a coarse acoustic window; CTC
                # supplies word times before any Romanization is applied.
                coarse = alignment_window(candidates, run['indices'], len(chunk)/SAMPLE_RATE)
                aligned = align([coarse], aligner, metadata, chunk, 'cpu',
                    interpolate_method='ignore', return_char_alignments=False)
                resolved = apply_alignment(run_words, aligned['word_segments'], len(chunk)/SAMPLE_RATE)
                for index, word in zip(run['indices'], resolved):
                    candidate_words[index] = word
        chunk_words, edits = accept_corrections(native, candidate_words)
        offset = window['read_start'] / SAMPLE_RATE
        for edit in edits:
            if window['own_start'] / SAMPLE_RATE <= (edit['start'] + edit['end']) / 2 + offset < window['own_end'] / SAMPLE_RATE:
                corrections.append({**edit, 'start': edit['start'] + offset, 'end': edit['end'] + offset})
        for word in restore_window_words(chunk_words, window):
            if words and word['start'] < words[-1]['end']:
                if word['text'].casefold() == words[-1]['text'].casefold():
                    continue
                word = {**word, 'start': words[-1]['end'], 'timingSource': 'native'}
            if word['end'] > word['start']:
                words.append(word)
    aligned_count = sum(w['timingSource'] == 'wav2vec2' for w in words)
    fallback_count = len(words) - aligned_count
    if fallback_count:
        warnings.append(f'{fallback_count} words use ASR timing and need review.' if args.alignment == 'whisperx'
                        else 'Forced alignment is disabled; timings are ASR estimates.')
    if corrections:
        warnings.append(f'{len(corrections)} vocabulary corrections were aligned to audio; review wording before publishing.')
    if any(s['end'] - s['start'] >= (max_chunk_seconds - 1) * SAMPLE_RATE for s in spans):
        warnings.append('Continuous speech reached the chunk limit; review words near long speech boundaries.')
    return {'language': language or 'en', 'duration': duration, 'words': words,
        'diagnostics': {'model': args.model, 'computeType': compute, 'alignment': args.alignment,
            'alignedWords': aligned_count, 'fallbackWords': fallback_count, 'chunkCount': len(windows),
            'speechSeconds': sum(s['end']-s['start'] for s in spans)/SAMPLE_RATE,
            'vocabulary': vocabulary, 'corrections': corrections,
            'warnings': warnings}}


if __name__ == '__main__':
    try:
        with redirect_stdout(sys.stderr):
            output = main()
        print(json.dumps(output, ensure_ascii=True))
    except Exception as error:
        print('Local speech transcription failed: ' + str(error), file=sys.stderr)
        sys.exit(1)
