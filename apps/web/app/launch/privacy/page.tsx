import type { Metadata } from 'next';
import { DocPage } from '@/components/launch/DocPage';
import { REPO_URL } from '@/components/launch/constants';

export const metadata: Metadata = {
  title: 'Privacy — LoCap',
  description: 'LoCap runs on your own computer. Your videos, audio and captions stay on your disk unless you choose a cloud provider.',
};

export default function PrivacyPage() {
  return (
    <DocPage title="Privacy" updated="21 November 2026" lede="LoCap runs on your own computer. Your videos, audio and captions stay on your disk unless you choose to connect a cloud provider.">
      <section>
        <h2>What the app stores</h2>
        <p>Uploaded videos, extracted audio, captions, styles and exports are saved where you point LoCap: a local folder (<code>STORAGE_ROOT</code>) or an S3-compatible bucket you configure. Project data lives in a local SQLite database. There are no LoCap accounts; the current build uses a single local user.</p>
      </section>
      <section>
        <h2>Speech recognition and Hinglish conversion</h2>
        <p>By default, recognition (Faster Whisper, Silero VAD, WhisperX) and Hinglish conversion (Qwen through Ollama) run on your machine, and no audio or text leaves it.</p>
        <ul>
          <li>If you set a transcription API key or a cloud AI provider in <code>.env</code>, audio or transcript text is sent to that provider and its own privacy terms apply.</li>
          <li>The setup script and Ollama download models from their hosts the first time. Those hosts can see your IP address.</li>
        </ul>
      </section>
      <section>
        <h2>No tracking</h2>
        <p>LoCap contains no analytics, advertising or telemetry, and it does not phone home.</p>
      </section>
      <section>
        <h2>This website</h2>
        <p>This site is a static page hosted on GitHub Pages. It sets no cookies, runs no analytics and has no forms. Fonts are served from the site itself. GitHub may log visitor IP addresses for security; see the <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement" target="_blank" rel="noreferrer">GitHub Privacy Statement</a>.</p>
      </section>
      <section>
        <h2>Changes and contact</h2>
        <p>Changes to this page are dated above. Questions go to the <a href={`${REPO_URL}/issues`} target="_blank" rel="noreferrer">GitHub issue tracker</a>.</p>
      </section>
    </DocPage>
  );
}
