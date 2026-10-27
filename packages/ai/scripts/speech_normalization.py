"""Vocabulary hints propose spellings; CTC must supply each changed word's timing."""
from difflib import SequenceMatcher
import re

CONSONANTS = dict(zip('कखगघङचछजझञटठडढणतथदधनपफबभमयरलवशषसह',
                     ['k','k','k','k','n','j','j','j','j','n','t','t','t','t','n',
                      't','t','t','t','n','b','b','b','b','m','y','r','l','b','s','s','s','h']))


def phonetic_key(text):
    text = re.sub(r'ch|sh|th|dh|ph|bh|kh|gh', lambda m: {'ch':'j', 'sh':'s', 'th':'t',
                  'dh':'t', 'ph':'b', 'bh':'b', 'kh':'k', 'gh':'k'}[m[0]], text.lower())
    native = ''.join(CONSONANTS.get(c, c if c.isascii() else '') for c in text)
    native = native.translate(str.maketrans({'g':'k','c':'k','d':'t','p':'b','f':'b','v':'b','z':'s'}))
    return re.sub(r'[^bcdfghjklmnpqrstvwxyz]', '', native)


def propose_corrections(words, vocabulary, ownership=None):
    matches = []
    for phrase in vocabulary:
        tokens = phrase.split()
        target = phonetic_key(phrase)
        # Short consonant skeletons are ambiguous; their decoder hints still apply.
        if len(target) < 3:
            continue
        for start in range(len(words)):
            for count in range(1, min(len(tokens) + 2, len(words) - start + 1)):
                source = words[start:start + count]
                if ownership and any(not ownership[0] <= w.get('_nativeMidpoint', (w['start'] + w['end']) / 2) < ownership[1] for w in source):
                    continue
                text = ' '.join(w['text'] for w in source)
                if text.casefold() != phrase.casefold() and all(w['confidence'] >= .95 for w in source):
                    continue
                score = SequenceMatcher(None, phonetic_key(text), target, autojunk=False).ratio()
                if score >= .8 and all(b['start'] - a['end'] < .3 for a, b in zip(source, source[1:])):
                    matches.append((score, count, start, tokens))
    proposals, occupied = {}, set()
    for score, count, start, tokens in sorted(matches, reverse=True):
        indices = set(range(start, start + count))
        if not indices & occupied:
            if ' '.join(w['text'] for w in words[start:start + count]).casefold() != ' '.join(tokens).casefold():
                proposals[start] = {'end': start + count, 'tokens': tokens}
            occupied.update(indices)
    return proposals


def correction_candidates(native, proposals):
    candidates, i = [], 0
    while i < len(native):
        proposal = proposals.get(i, {'end': i + 1, 'tokens': [native[i]['text']]})
        end = proposal['end']
        # This interval is a coarse alignment window, never fabricated word times.
        candidates.extend({**native[i], 'text': token, 'end': native[end - 1]['end'],
                           '_sourceIndex': i, '_sourceEnd': end} for token in proposal['tokens'])
        i = end
    return candidates


def accept_corrections(native, aligned):
    groups = {}
    for word in aligned:
        groups.setdefault(word['_sourceIndex'], []).append(word)
    originals, accepted = {}, {}
    for i, group in groups.items():
        source = native[i:group[0]['_sourceEnd']]
        originals[i] = source
        changed = [w['text'] for w in group] != [w['text'] for w in source]
        if changed and not (all(w.get('timingSource') == 'wav2vec2'
                and w.get('alignmentScore', 0) >= .15
                and source[0]['start'] - .5 <= w['start'] < w['end'] <= source[-1]['end'] + .5
                for w in group)
                and all(a['end'] <= b['start'] + .001 for a, b in zip(group, group[1:]))):
            group = source
        accepted[i] = group
    # Restoring a rejected phrase must not overlap its neighbors' corrected times.
    for _ in native:
        sequence = [(i, w) for i, group in accepted.items() for w in group]
        conflicts = {i for (ia, a), (ib, b) in zip(sequence, sequence[1:])
                     if a['end'] > b['start'] + .001 for i in (ia, ib)
                     if accepted[i] != originals[i]}
        if not conflicts:
            break
        for i in conflicts:
            accepted[i] = originals[i]
    words, edits = [], []
    for i, group in accepted.items():
        if [w['text'] for w in group] != [w['text'] for w in originals[i]]:
            edits.append({'source': ' '.join(w['text'] for w in originals[i]),
                          'replacement': ' '.join(w['text'] for w in group),
                          'start': group[0]['start'], 'end': group[-1]['end']})
        words.extend({k: v for k, v in w.items() if k not in ('_sourceIndex', '_sourceEnd')} for w in group)
    return words, edits
