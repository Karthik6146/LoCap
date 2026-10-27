"""Pure timeline helpers. All boundaries stay on the source audio clock."""
import math
import re
import unicodedata

SAMPLE_RATE = 16000


def transcribe_window(model, audio, language, vocabulary=None):
    """Detect each window independently; never carry the previous language forward."""
    mixed = language == 'auto'
    restricted = language in ('en', 'hi', 'hi-latn')
    allow_hindi = language in ('hi', 'hi-latn')
    if language == 'hi-latn':
        detected, _, probabilities = model.detect_language(audio)
        # Hindi and Urdu speech is easily confused. Never select Urdu's script
        # for Hinglish; still detect English independently in every VAD window.
        language = 'hi' if detected == 'ur' else max(
            ((lang, score) for lang, score in probabilities if lang in ('hi', 'en')),
            key=lambda item: item[1], default=('hi', 0))[0]
    options = dict(language=None if mixed else language,
        task='transcribe', multilingual=mixed,
        initial_prompt=', '.join(vocabulary or []) or None,
        hotwords=', '.join(vocabulary or []) or None,
        word_timestamps=True, vad_filter=False, beam_size=5, temperature=0,
        condition_on_previous_text=False, no_speech_threshold=0.6,
        log_prob_threshold=-1.0, compression_ratio_threshold=2.4,
        hallucination_silence_threshold=1.0)
    def recognize():
        segments, info = model.transcribe(audio, **options)
        return list(segments), info

    def wrong_script(segments):
        if not restricted:
            return False
        return any(c.isalpha() and not (unicodedata.name(c, '').startswith('LATIN ')
            or allow_hindi and '\u0900' <= c <= '\u097f')
            for segment in segments for word in segment.words or [] for c in word.word)

    segments, info = recognize()
    if wrong_script(segments) and vocabulary:
        # Whisper prompts can trigger script drift even with a source-language token.
        options.update(initial_prompt=None, hotwords=None)
        segments, info = recognize()
    if wrong_script(segments):
        raise ValueError('Recognition returned a script outside the selected language after retry.')
    return segments, info


def speech_windows(spans, total_samples, max_seconds=28, context_seconds=0.25):
    """Pack adjacent VAD spans without crossing the ASR context limit."""
    limit = int(max_seconds * SAMPLE_RATE)
    context = int(context_seconds * SAMPLE_RATE)
    groups = []
    for span in spans:
        start, end = int(span['start']), int(span['end'])
        if not 0 <= start < end <= total_samples:
            raise ValueError('Invalid VAD boundary')
        if groups and end - groups[-1]['start'] <= limit and start - groups[-1]['end'] <= int(.6 * SAMPLE_RATE):
            groups[-1]['end'] = end
        else:
            groups.append({'start': start, 'end': end})
    windows = [{**g, 'read_start': max(0, g['start'] - context),
                'read_end': min(total_samples, g['end'] + context)} for g in groups]
    # Own the surrounding audio too: quiet syllables can fall just outside VAD.
    # Split overlapping context between neighbors so each instant has one owner.
    for i, window in enumerate(windows):
        window['own_start'] = max(window['read_start'],
            (groups[i - 1]['end'] + window['start']) // 2) if i else window['read_start']
        window['own_end'] = min(window['read_end'],
            (window['end'] + groups[i + 1]['start']) // 2) if i + 1 < len(windows) else window['read_end']
    return windows


def word_language(text, default='en'):
    if re.search(r'[\u0900-\u097f]', text):
        return 'hi'
    return 'en' if re.search('[A-Za-z]', text) else default


def alignment_runs(words):
    """Align Hindi in native script; Latin runs use the English CTC vocabulary."""
    runs = []
    for i, word in enumerate(words):
        language = word_language(word['text'], runs[-1]['language'] if runs else 'en')
        if runs and runs[-1]['language'] == language:
            runs[-1]['indices'].append(i)
        else:
            runs.append({'language': language, 'indices': [i]})
    return runs


def alignment_window(words, indices, duration):
    first, last = indices[0], indices[-1]
    start = max(0, words[first]['start'] - .35)
    end = min(duration, words[last]['end'] + .35)
    # Adjacent language models must not align overlapping parts of the same audio.
    if first:
        start = max(start, (words[first - 1]['end'] + words[first]['start']) / 2)
    if last + 1 < len(words):
        end = min(end, (words[last]['end'] + words[last + 1]['start']) / 2)
    return {'text': ' '.join(words[i]['text'] for i in indices), 'start': start, 'end': end}


def apply_alignment(native, aligned, duration):
    """Never silently invent missing CTC times or lose unsupported tokens."""
    result = [{**w, 'timingSource': 'native'} for w in native]
    if len(native) != len(aligned):
        return result
    for i, (word, candidate) in enumerate(zip(native, aligned)):
        start, end, score = candidate.get('start'), candidate.get('end'), candidate.get('score')
        if (candidate.get('word', '').strip() == word['text'] and
                all(isinstance(v, (int, float)) and math.isfinite(v) for v in (start, end, score))
                and 0 <= start < end <= duration and score >= 0.1):
            result[i] = {**word, 'start': start, 'end': end, 'timingSource': 'wav2vec2', 'alignmentScore': score}
    return resolve_timing_conflicts(native, result)


def resolve_timing_conflicts(native, candidates):
    """Revert only conflicting words, not all successfully aligned speech."""
    result = [dict(w) for w in candidates]
    for _ in range(len(result)):
        conflicts = {i for j, (a, b) in enumerate(zip(result, result[1:]))
                     if a['end'] > b['start'] + .001 for i in (j, j + 1)
                     if result[i].get('timingSource') == 'wav2vec2'}
        if not conflicts:
            break
        for i in conflicts:
            result[i] = {**native[i], 'timingSource': 'native'}
    return result


def restore_window_words(words, window):
    offset = window['read_start'] / SAMPLE_RATE
    start = window.get('own_start', window['start']) / SAMPLE_RATE
    end = window.get('own_end', window['end']) / SAMPLE_RATE
    restored = []
    for word in words:
        w = {**word, 'start': word['start'] + offset, 'end': word['end'] + offset}
        # Decide context ownership using ASR's original estimate. A legitimate
        # CTC timing correction must not make a recognized token disappear.
        midpoint = w.pop('_nativeMidpoint', (word['start'] + word['end']) / 2) + offset
        if start <= midpoint < end:
            restored.append(w)
    return restored
