import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Env, Transcript } from '@clipx/types';
import type { TranscriptionProvider, TranscribeOptions } from './transcription';

export class LocalTranscriptionProvider implements TranscriptionProvider {
  readonly name = 'local-whisper';
  constructor(private readonly config: NonNullable<Env['localTranscription']>) {}

  async transcribe(audio: string, opts: TranscribeOptions = {}): Promise<Transcript> {
    const root = fileURLToPath(new URL('../../../', import.meta.url));
    const python = this.config.python || path.join(root, '.venv-whisper', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
    const script = fileURLToPath(new URL('../scripts/transcribe-local.py', import.meta.url));
    const output = await new Promise<string>((resolve, reject) => {
      const args = [script, '--audio', audio, '--model', this.config.model, '--device', this.config.device, '--language', opts.language ?? 'auto', '--alignment', this.config.alignment ?? 'native'];
      if (this.config.alignModelEn) args.push('--align-model-en', this.config.alignModelEn);
      if (this.config.alignModelHi) args.push('--align-model-hi', this.config.alignModelHi);
      if (opts.vocabulary?.length) args.push('--vocabulary', JSON.stringify(opts.vocabulary));
      execFile(python, args, {
        windowsHide: true, timeout: 60 * 60 * 1000, maxBuffer: 32 * 1024 * 1024,
        env: { ...process.env, HF_HUB_OFFLINE: '1', TRANSFORMERS_OFFLINE: '1', PYTHONIOENCODING: 'utf-8' },
      }, (err, stdout, stderr) => {
        if (err) reject(new Error(`Local speech transcription failed. Check the local Python environment and downloaded model. ${stderr.slice(-500) || err.message}`));
        else resolve(stdout);
      });
    });
    const raw = JSON.parse(output) as { language: Transcript['language']; duration: number; diagnostics?: Transcript['diagnostics']; words: { text: string; start: number; end: number; confidence: number }[] };
    if (!Array.isArray(raw.words) || raw.words.some(w => !w.text || !Number.isFinite(w.start) || !Number.isFinite(w.end) || w.start < 0 || w.end <= w.start)) throw new Error('Local transcription returned invalid word timestamps.');
    if (opts.language === 'en' || opts.language === 'hi-latn') {
      const allowed = opts.language === 'en' ? /\p{Script=Latin}/u : /[\p{Script=Latin}\p{Script=Devanagari}]/u;
      if (raw.words.some(w => [...w.text].some(c => /\p{L}/u.test(c) && !allowed.test(c)))) {
        throw new Error('Recognition returned text outside the selected language. Captions were not replaced; retry with clearer audio.');
      }
    }
    const words = raw.words.map(w => ({ ...w, id: randomUUID() }));
    return { language: raw.language, script: words.some(w => /[\u0900-\u097f]/.test(w.text)) ? 'mixed' : 'en', duration: opts.audioDuration ?? raw.duration, words, sentences: [], silences: [], diagnostics: raw.diagnostics, confidence: words.length ? words.reduce((n,w) => n+w.confidence,0)/words.length : 0 };
  }
}
