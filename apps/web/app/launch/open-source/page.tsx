import type { Metadata } from 'next';
import { DocPage } from '@/components/launch/DocPage';
import { LICENSE_URL, NOTICES_URL, REPO_URL } from '@/components/launch/constants';

export const metadata: Metadata = {
  title: 'Open source — LoCap',
  description: 'LoCap is MIT licensed and built on open source speech, video and web tools.',
};

const GROUPS: { title: string; items: [name: string, role: string, licence: string][] }[] = [
  {
    title: 'Speech and language',
    items: [
      ['Faster Whisper', 'Speech recognition', 'MIT'],
      ['CTranslate2', 'Inference engine for Whisper', 'MIT'],
      ['WhisperX', 'Word-level forced alignment', 'BSD-2-Clause'],
      ['Silero VAD', 'Speech window detection', 'MIT'],
      ['Ollama', 'Local model runtime for Hinglish conversion', 'MIT'],
    ],
  },
  {
    title: 'Video',
    items: [
      ['FFmpeg', 'Audio extraction, cutting and burn-in', 'LGPL-2.1+'],
      ['libass', 'Subtitle rendering in exports', 'ISC'],
    ],
  },
  {
    title: 'App and site',
    items: [
      ['Next.js', 'Web app and this site', 'MIT'],
      ['React', 'Interface', 'MIT'],
      ['Tailwind CSS', 'Styling', 'MIT'],
      ['Motion', 'Animation', 'MIT'],
      ['Lucide', 'Icons', 'ISC'],
      ['Prisma', 'Database access', 'Apache-2.0'],
      ['SQLite', 'Local database', 'Public domain'],
      ['AWS SDK for JavaScript', 'S3-compatible storage', 'Apache-2.0'],
      ['Vitest and Playwright', 'Tests', 'MIT, Apache-2.0'],
    ],
  },
  {
    title: 'Fonts',
    items: [
      ['Inter, Space Grotesk', 'Interface type', 'OFL-1.1'],
      ['Montserrat, Noto Sans Devanagari, Anton, Poppins, Baloo 2, Rozha One, Teko, Playfair Display', 'Caption templates', 'OFL-1.1'],
    ],
  },
];

export default function OpenSourcePage() {
  return (
    <DocPage title="Open source" updated="21 November 2026" lede="LoCap is open source under the MIT License, and it stands on the work of many other open source projects.">
      <section>
        <h2>LoCap</h2>
        <p>The full source is on <a href={REPO_URL} target="_blank" rel="noreferrer">GitHub</a> under the <a href={LICENSE_URL} target="_blank" rel="noreferrer">MIT License</a>. You can run it, study it, change it and share it.</p>
      </section>
      {GROUPS.map(group => (
        <section key={group.title}>
          <h2>{group.title}</h2>
          <dl className="divide-y divide-border rounded-2xl border border-border">
            {group.items.map(([name, role, licence]) => (
              <div key={name} className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-4">
                <dt className="text-gray-100">{name}<span className="block text-sm text-gray-500">{role}</span></dt>
                <dd className="text-sm text-gray-400 sm:text-right">{licence}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
      <section>
        <h2>Models and references</h2>
        <ul>
          <li>Whisper, alignment and Qwen model weights are downloaded separately and keep the licences set by their publishers.</li>
          <li>The caption template system took design cues from the MIT-licensed templates in tscaps; no tscaps application code is included.</li>
          <li>Launch site motion was inspired by React Bits and Vengeance UI; the components are original.</li>
        </ul>
        <p className="mt-4">Full notices are in <a href={NOTICES_URL} target="_blank" rel="noreferrer">THIRD_PARTY_NOTICES.md</a>.</p>
      </section>
    </DocPage>
  );
}
