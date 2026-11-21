import Link from 'next/link';
import { Logo } from '@/components/ui';
import { GithubMark } from './GithubMark';
import { REPO_URL, launchHref } from './constants';

const NAV = [
  { href: '#why', label: 'Why LoCap' },
  { href: '#templates', label: 'Templates' },
  { href: '#how', label: 'How it works' },
  { href: '#start', label: 'Get started' },
];

/** Sticky launch-site header, shared by the home page and the legal and open source pages. */
export function LaunchHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-6">
        <Link href={launchHref('') || '/'} aria-label="LoCap home"><Logo /></Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Sections">
          {NAV.map(item => (
            <Link key={item.href} href={launchHref(item.href)} className="flex h-9 items-center rounded-lg px-3 text-sm text-gray-400 transition-colors hover:bg-surface2 hover:text-gray-100">{item.label}</Link>
          ))}
        </nav>
        <a href={REPO_URL} className="btn btn-secondary" target="_blank" rel="noreferrer">
          <GithubMark />
          <span className="hidden sm:inline">GitHub</span>
        </a>
      </div>
    </header>
  );
}
