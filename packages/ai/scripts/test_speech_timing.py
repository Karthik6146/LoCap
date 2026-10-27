import unittest
from unittest.mock import Mock
from types import SimpleNamespace
from speech_timing import transcribe_window
from speech_timing import speech_windows, restore_window_words, alignment_runs, alignment_window, apply_alignment, resolve_timing_conflicts


class TimingTests(unittest.TestCase):
    def test_code_switch_alignment_windows_do_not_compete_for_neighbor_speech(self):
        words = [{'text': 'हूं', 'start': 1., 'end': 2.2},
                 {'text': 'Minecraft', 'start': 2.2, 'end': 2.7},
                 {'text': 'Java', 'start': 2.8, 'end': 3.},
                 {'text': 'को', 'start': 3., 'end': 3.5}]
        bounds = [alignment_window(words, r['indices'], 4) for r in alignment_runs(words)]
        self.assertEqual(bounds[0]['end'], bounds[1]['start'])
        self.assertEqual(bounds[1]['end'], bounds[2]['start'])
        self.assertEqual(bounds[1], {'text': 'Minecraft Java', 'start': 2.2, 'end': 3.})
        self.assertTrue(all(0 <= b['start'] < b['end'] <= 4 for b in bounds))

    def test_vocabulary_is_used_for_decoder_context_and_hotwords(self):
        model = Mock()
        model.transcribe.return_value = ([], SimpleNamespace(language='en'))
        transcribe_window(model, [], 'en', ['Minecraft', 'search bar'])
        self.assertEqual(model.transcribe.call_args.kwargs['initial_prompt'], 'Minecraft, search bar')
        self.assertEqual(model.transcribe.call_args.kwargs['hotwords'], 'Minecraft, search bar')

    def test_hinglish_restricts_urdu_and_recovers_hindi_after_english(self):
        model = Mock()
        model.transcribe.return_value = ([], SimpleNamespace(language='hi'))
        model.detect_language.side_effect = [
            ('ur', .8, [('ur', .8), ('en', .15), ('hi', .05)]),
            ('en', .9, [('en', .9), ('hi', .1)]),
            ('hi', .9, [('hi', .9), ('en', .1)]),
            ('ar', .8, [('ar', .8), ('hi', .15), ('en', .05)]),
        ]
        for _ in range(4):
            transcribe_window(model, [], 'hi-latn')
        self.assertEqual([c.kwargs['language'] for c in model.transcribe.call_args_list], ['hi', 'en', 'hi', 'hi'])
        self.assertTrue(all(not c.kwargs['multilingual'] for c in model.transcribe.call_args_list))

    def test_hindi_english_hindi_does_not_lock_first_language(self):
        model = Mock()
        model.transcribe.side_effect = [([], SimpleNamespace(language=l)) for l in ['hi', 'en', 'hi']]
        detected = [transcribe_window(model, [], 'auto')[1].language for _ in range(3)]
        self.assertEqual(detected, ['hi', 'en', 'hi'])
        for call in model.transcribe.call_args_list:
            self.assertIsNone(call.kwargs['language'])
            self.assertTrue(call.kwargs['multilingual'])
            self.assertEqual(call.kwargs['task'], 'transcribe')

    def test_explicit_english_remains_english(self):
        model = Mock()
        model.transcribe.return_value = ([], SimpleNamespace(language='en'))
        transcribe_window(model, [], 'en')
        self.assertEqual(model.transcribe.call_args.kwargs['language'], 'en')
        self.assertFalse(model.transcribe.call_args.kwargs['multilingual'])

    def test_prompt_script_drift_retries_without_hints_and_preserves_speech(self):
        model = Mock()
        bad = SimpleNamespace(words=[SimpleNamespace(word='\u06c1\u0644\u0648')])
        good = SimpleNamespace(words=[SimpleNamespace(word='hello')])
        model.transcribe.side_effect = [([bad], SimpleNamespace(language='en')), ([good], SimpleNamespace(language='en'))]
        segments, info = transcribe_window(model, [], 'en', ['hello'])
        self.assertEqual(segments, [good])
        self.assertEqual(model.transcribe.call_count, 2)
        self.assertIsNone(model.transcribe.call_args.kwargs['initial_prompt'])
        self.assertIsNone(model.transcribe.call_args.kwargs['hotwords'])

    def test_script_drift_after_retry_fails_instead_of_dropping_words(self):
        model = Mock()
        bad = SimpleNamespace(words=[SimpleNamespace(word='\u06c1\u0644\u0648')])
        model.transcribe.side_effect = [([bad], SimpleNamespace(language='en')), ([bad], SimpleNamespace(language='en'))]
        with self.assertRaises(ValueError):
            transcribe_window(model, [], 'en', ['hello'])
        self.assertEqual(model.transcribe.call_count, 2)

    def test_other_explicit_languages_keep_their_existing_script_support(self):
        model = Mock()
        arabic = SimpleNamespace(words=[SimpleNamespace(word='مرحبا')])
        model.transcribe.return_value = ([arabic], SimpleNamespace(language='ar'))
        self.assertEqual(transcribe_window(model, [], 'ar')[0], [arabic])

    def test_hinglish_allows_native_hindi_inside_an_english_window(self):
        model = Mock()
        model.detect_language.return_value = ('en', .9, [('en', .9), ('hi', .1)])
        mixed_words = SimpleNamespace(words=[SimpleNamespace(word='hello'), SimpleNamespace(word='आज')])
        model.transcribe.return_value = ([mixed_words], SimpleNamespace(language='en'))
        self.assertEqual(transcribe_window(model, [], 'hi-latn', ['hello'])[0], [mixed_words])
        self.assertEqual(model.transcribe.call_count, 1)

    def test_preserves_silence_offsets(self):
        windows = speech_windows([{'start': 160000, 'end': 192000}, {'start': 960000, 'end': 992000}], 1100000)
        self.assertEqual(len(windows), 2)
        words = restore_window_words([{'text': 'hello', 'start': .5, 'end': 1}], windows[1])
        self.assertEqual(words[0]['start'], 60.25)

    def test_packs_only_at_vad_boundaries(self):
        spans = [{'start': 16000, 'end': 32000}, {'start': 36000, 'end': 48000}, {'start': 640000, 'end': 656000}]
        windows = speech_windows(spans, 700000)
        self.assertEqual([(w['start'], w['end']) for w in windows], [(16000, 48000), (640000, 656000)])

    def test_code_mixed_alignment_routing(self):
        self.assertEqual([r['language'] for r in alignment_runs([{'text': 'आज'}, {'text': 'game'}, {'text': 'है'}])], ['hi', 'en', 'hi'])

    def test_missing_ctc_times_are_not_invented(self):
        source = [{'text': 'hello', 'start': .1, 'end': .8}, {'text': '2026', 'start': 1, 'end': 1.5}]
        result = apply_alignment(source, [{'word': 'hello', 'start': .2, 'end': .7, 'score': .8}, {'word': '2026'}], 2)
        self.assertEqual(result[0]['timingSource'], 'wav2vec2')
        self.assertEqual(result[1]['start'], 1)
        self.assertEqual(result[1]['timingSource'], 'native')

    def test_overlapping_alignment_is_rejected(self):
        source = [{'text': 'a', 'start': .1, 'end': .8}, {'text': 'b', 'start': 1, 'end': 1.5}]
        result = apply_alignment(source, [{'word': 'a', 'start': .1, 'end': 1.2, 'score': .8}, {'word': 'b', 'start': 1, 'end': 1.5, 'score': .8}], 2)
        self.assertTrue(all(w['timingSource'] == 'native' for w in result))

    def test_quiet_word_in_vad_padding_is_preserved(self):
        w = speech_windows([{'start': 160000, 'end': 192000}], 200000)[0]
        words = restore_window_words([{'text': 'neighbor', 'start': 0, 'end': .1}, {'text': 'owned', 'start': .3, 'end': .6}], w)
        self.assertEqual([x['text'] for x in words], ['neighbor', 'owned'])

    def test_adjacent_windows_own_boundary_word_exactly_once(self):
        windows = speech_windows([{'start': 0, 'end': 192000},
                                  {'start': 192000, 'end': 384000}], 400000, max_seconds=12)
        absolute_start, absolute_end = 11.98, 12.08
        results = []
        for window in windows:
            offset = window['read_start'] / 16000
            results.extend(restore_window_words([{'text': 'switch',
                'start': absolute_start - offset, 'end': absolute_end - offset}], window))
        self.assertEqual(len(results), 1)
        self.assertAlmostEqual(results[0]['start'], absolute_start)

    def test_alignment_correction_does_not_change_context_ownership(self):
        w = speech_windows([{'start': 160000, 'end': 192000}], 200000)[0]
        words = restore_window_words([{'text': 'kept', 'start': .05, 'end': .15, '_nativeMidpoint': .4}], w)
        self.assertEqual([x['text'] for x in words], ['kept'])
        self.assertNotIn('_nativeMidpoint', words[0])

    def test_conflicts_keep_unaffected_alignment(self):
        native = [{'text': 'one', 'start': 0, 'end': 1}, {'text': 'two', 'start': 1, 'end': 2}, {'text': 'three', 'start': 3, 'end': 4}]
        candidates = [{**w, 'timingSource': 'wav2vec2'} for w in native]
        candidates[0]['end'] = 1.2
        result = resolve_timing_conflicts(native, candidates)
        self.assertEqual([w['timingSource'] for w in result], ['native', 'native', 'wav2vec2'])


if __name__ == '__main__':
    unittest.main()
