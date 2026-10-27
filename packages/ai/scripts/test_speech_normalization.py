import unittest
from speech_normalization import propose_corrections, correction_candidates, accept_corrections


def words(text, confidence=.8):
    return [{'text': t, 'start': 1 + i * .3, 'end': 1.2 + i * .3,
             'confidence': confidence, 'timingSource': 'native'} for i, t in enumerate(text.split())]


class NormalizationTests(unittest.TestCase):
    def test_vocabulary_recovers_close_mixed_script_phrases(self):
        for source, phrase in [('सजवार', 'search bar'), ('पिरना टाइम वेस्ट', 'बिना टाइम वेस्ट'),
                               ('पहरी लिंक', 'पहली लिंक'), ('एंड देन', 'and then')]:
            raw = words(source)
            proposal = propose_corrections(raw, [phrase])
            self.assertEqual(proposal, {0: {'end': len(raw), 'tokens': phrase.split()}})

    def test_no_hints_confident_words_and_unrelated_phrases_are_unchanged(self):
        self.assertEqual(propose_corrections(words('सजवार'), []), {})
        self.assertEqual(propose_corrections(words('सजवार', .99), ['search bar']), {})
        self.assertEqual(propose_corrections(words('पहरी सड़क'), ['पहली लिंक']), {})
        self.assertEqual(propose_corrections(words('Minecraft Java Edition'), ['Minecraft Java Edition']), {})

    def test_fused_phrase_requires_distinct_actual_alignment(self):
        raw = words('सजवार')
        candidates = correction_candidates(raw, {0: {'end': 1, 'tokens': ['search', 'bar']}})
        self.assertEqual([(w['start'], w['end']) for w in candidates], [(1., 1.2), (1., 1.2)])
        aligned = [{**candidates[0], 'start': 1.01, 'end': 1.1, 'timingSource': 'wav2vec2', 'alignmentScore': .8},
                   {**candidates[1], 'start': 1.11, 'end': 1.19, 'timingSource': 'wav2vec2', 'alignmentScore': .7}]
        result, edits = accept_corrections(raw, aligned)
        self.assertEqual([w['text'] for w in result], ['search', 'bar'])
        self.assertEqual(result[1]['start'], 1.11)
        self.assertEqual(edits[0]['source'], 'सजवार')

    def test_unaligned_weak_or_overlapping_corrections_keep_original(self):
        raw = words('सजवार next')
        candidates = correction_candidates(raw, {0: {'end': 1, 'tokens': ['search', 'bar']}})
        for score in [None, .01, .8]:
            trial = [dict(w) for w in candidates]
            if score is not None:
                trial[0].update(start=1., end=1.15, timingSource='wav2vec2', alignmentScore=score)
                trial[1].update(start=1.16, end=1.4, timingSource='wav2vec2', alignmentScore=score)
            self.assertEqual(accept_corrections(raw, trial), (raw, []))

    def test_rejected_phrase_restores_all_source_words(self):
        raw = words('पिरना टाइम वेस्ट')
        candidates = correction_candidates(raw, propose_corrections(raw, ['बिना टाइम वेस्ट']))
        self.assertEqual(accept_corrections(raw, candidates), (raw, []))

    def test_phrases_do_not_cross_silence(self):
        raw = words('एंड देन')
        raw[1]['start'] = 3
        raw[1]['end'] = 3.2
        self.assertEqual(propose_corrections(raw, ['and then']), {})

    def test_short_ambiguous_words_need_phrase_context(self):
        self.assertEqual(propose_corrections(words('दिन'), ['then']), {})
        self.assertEqual(propose_corrections(words('पीना'), ['बिना']), {})

    def test_a_corrected_phrase_does_not_steal_words_owned_by_another_window(self):
        raw = words('माइनकाफ जाव एडिसन')
        self.assertEqual(propose_corrections(raw, ['Minecraft Java Edition'], (0, 1.5)), {})
        self.assertIn(0, propose_corrections(raw, ['Minecraft Java Edition'], (0, 2)))


if __name__ == '__main__':
    unittest.main()
