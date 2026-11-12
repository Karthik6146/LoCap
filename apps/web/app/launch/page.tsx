import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { GithubMark } from '@/components/launch/GithubMark';
import { Logo } from '@/components/ui';
import { HeroArt } from '@/components/launch/HeroArt';
import { HeroDemo } from '@/components/launch/HeroDemo';
import { HeroHeadline } from '@/components/launch/HeroHeadline';
import { TiltCard } from '@/components/launch/TiltCard';
import { ScriptTicker } from '@/components/launch/ScriptTicker';
import { TemplateWall } from '@/components/launch/TemplateWall';
import { GetStarted, HowItWorks, LaunchFooter, ProofSection, Roadmap, WhySection } from '@/components/launch/Sections';
import { REPO_URL } from '@/components/launch/constants';

export const metadata: Metadata = {
  title: 'LoCap — Captions that keep up with Hinglish',
  description: 'Word-timed captions for Hindi, English and Hinglish videos. Recognition, alignment and Hinglish conversion run on your own machine.',
};

const NAV = [
  { href: '#why', label: 'Why LoCap' },
  { href: '#templates', label: 'Templates' },
  { href: '#how', label: 'How it works' },
  { href: '#start', label: 'Get started' },
];

export default function LaunchPage() {
  return (
    <div className="min-h-screen">
      <a href="#main" className="skip-link">Skip to content</a>
      <header className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-6">
          <Link href="/launch" aria-label="LoCap home"><Logo /></Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Sections">
            {NAV.map(item => (
              <a key={item.href} href={item.href} className="flex h-9 items-center rounded-lg px-3 text-sm text-gray-400 transition-colors hover:bg-surface2 hover:text-gray-100">{item.label}</a>
            ))}
          </nav>
          <a href={REPO_URL} className="btn btn-secondary" target="_blank" rel="noreferrer">
            <GithubMark />
            <span className="hidden sm:inline">GitHub</span>
          </a>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="outline-none">
        <div className="relative isolate overflow-hidden">
        <HeroArt />
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-24 pt-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:pt-24">
          <div>
            <HeroHeadline>
            <p className="mt-6 max-w-xl text-lg leading-8 text-gray-400">
              Upload a video and get captions timed word by word, even when Hindi and English share a sentence. Polish every word in the studio, then export an MP4 or SRT. Recognition runs on your own machine.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href={REPO_URL} className="btn btn-primary min-h-12 px-5" target="_blank" rel="noreferrer">
                <GithubMark />
                View on GitHub
              </a>
              <a href="#how" className="btn btn-text min-h-12 px-4">
                How it works
                <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
              </a>
            </div>
            </HeroHeadline>
          </div>
          <TiltCard><HeroDemo /></TiltCard>
        </section>
        </div>

        <ScriptTicker />
        <WhySection />
        <TemplateWall />
        <HowItWorks />
        <ProofSection />
        <GetStarted />
        <Roadmap />
      </main>
      <LaunchFooter />
    </div>
  );
}
