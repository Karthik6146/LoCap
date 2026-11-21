import type { Metadata } from 'next';
import Link from 'next/link';
import { DocPage } from '@/components/launch/DocPage';
import { LICENSE_URL, NOTICES_URL, REPO_URL, launchHref } from '@/components/launch/constants';

export const metadata: Metadata = {
  title: 'Terms — LoCap',
  description: 'LoCap is free, open source software under the MIT License, provided as is.',
};

export default function TermsPage() {
  return (
    <DocPage title="Terms" updated="21 November 2026" lede="LoCap is free, open source software under the MIT License. Use it, change it and share it, as long as the licence notice travels with it.">
      <section>
        <h2>Licence</h2>
        <p>The LoCap source code is released under the <a href={LICENSE_URL} target="_blank" rel="noreferrer">MIT License</a>. Copyright © 2026 Karthik Shakyawar.</p>
      </section>
      <section>
        <h2>No warranty</h2>
        <p>LoCap is provided as is, without warranty of any kind. The authors are not liable for any claim, damage or loss arising from its use, as the MIT License sets out in full.</p>
      </section>
      <section>
        <h2>Your content</h2>
        <ul>
          <li>You are responsible for having the rights to the videos you process and the captions you publish.</li>
          <li>LoCap claims no rights over your media, transcripts or exports.</li>
          <li>Automatic recognition can make mistakes, especially with names and fast language switches. Review captions before you publish them; words LoCap could not align to the audio are flagged for review.</li>
        </ul>
      </section>
      <section>
        <h2>Third-party software and services</h2>
        <p>LoCap builds on open source tools, models and fonts that keep their own licences; see <Link href={launchHref('/open-source')}>Open source</Link> and the <a href={NOTICES_URL} target="_blank" rel="noreferrer">third-party notices</a>. If you connect a cloud speech or AI provider, that provider&apos;s terms apply to what you send it.</p>
      </section>
      <section>
        <h2>Changes and contact</h2>
        <p>Changes to these terms are dated above. Questions go to the <a href={`${REPO_URL}/issues`} target="_blank" rel="noreferrer">GitHub issue tracker</a>.</p>
      </section>
    </DocPage>
  );
}
