import type { ReactNode } from 'react';
import { LaunchHeader } from './LaunchHeader';
import { LaunchFooter } from './Sections';

/** Long-form launch page (privacy, terms, open source): shared header and footer, readable measure. */
export function DocPage({ title, lede, updated, children }: { title: string; lede: string; updated: string; children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <a href="#main" className="skip-link">Skip to content</a>
      <LaunchHeader />
      <main id="main" tabIndex={-1} className="mx-auto max-w-3xl px-6 py-16 outline-none lg:py-24">
        <p className="kicker mb-4">Last updated <time>{updated}</time></p>
        <h1 className="font-display text-4xl font-medium tracking-tight text-gray-100 sm:text-5xl">{title}</h1>
        <p className="mt-6 text-lg leading-8 text-gray-400">{lede}</p>
        <div className="mt-12 space-y-10 text-base leading-7 text-gray-400 [&_a]:text-gray-100 [&_a]:underline [&_a]:decoration-gray-600 [&_a]:underline-offset-4 hover:[&_a]:decoration-gray-300 [&_code]:rounded [&_code]:bg-surface2 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-sm [&_code]:text-gray-100 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-medium [&_h2]:text-gray-100 [&_li]:mt-2 [&_ul]:list-disc [&_ul]:pl-5">
          {children}
        </div>
      </main>
      <LaunchFooter />
    </div>
  );
}
