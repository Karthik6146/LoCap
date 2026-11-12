import { ArrowRight, AudioLines, BookText, HardDrive, LayoutTemplate, ScanEye, type LucideIcon } from 'lucide-react';
import { CountUp, Logo } from '@/components/ui';
import { GithubMark } from './GithubMark';
import { CopyButton } from './section-copy-button';
import { Pipeline } from './section-pipeline';
import { Reveal } from './Reveal';
import { FooterWordmark } from './FooterWordmark';
import { REPO_URL, SECTION, SECTION_LEDE, SECTION_TITLE } from './constants';

/* Every fact on this page comes from README.md. */

const ICON = { size: 18, strokeWidth: 1.5, className: 'mt-0.5 shrink-0 text-gray-500', 'aria-hidden': true } as const;

const POINTS: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: AudioLines, title: 'Word-accurate timing', body: 'Silero VAD speech windows plus WhisperX wav2vec2 forced alignment. Words that cannot be aligned are flagged for review, never silently guessed.' },
  { icon: BookText, title: 'Your vocabulary', body: 'Add names and phrases like “Minecraft, search bar” to guide the decoder. Sound-alike corrections are only accepted when the audio confirms them.' },
  { icon: LayoutTemplate, title: '40 caption templates', body: 'Six categories with search, live previews in Hinglish, Hindi or English, and your own saved templates.' },
  { icon: ScanEye, title: 'What you see is what you export', body: 'The browser preview and the FFmpeg/libass export share one presentation model, and an automated check compares them frame by frame.' },
  { icon: HardDrive, title: 'Runs locally', body: 'No cloud speech API and no upload to third parties. Your media stays on your disk.' },
];

export function WhySection() {
  return (
    <section id="why" className={SECTION.replace(" border-t border-border", "")}>
      <Reveal>
      <h2 className={SECTION_TITLE}>Built for how India talks</h2>
      <p className={SECTION_LEDE}>
        Most caption tools treat Hinglish as an afterthought. LoCap is built around Hindi and English in the same sentence, names and brand terms that generic models miss, and audiences that read either Roman or Devanagari script.
      </p>

      <div className="mt-12 grid gap-8 rounded-2xl border border-border bg-surface p-6 sm:p-8 lg:grid-cols-2 lg:items-center">
        <div>
          <h3 className="font-display text-xl font-medium text-gray-100">Hinglish first</h3>
          <p className="mt-2 text-sm leading-6 text-gray-400">
            Per-window Hindi/English recognition, then word-by-word conversion to natural Roman Hinglish with timings preserved.
          </p>
        </div>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-2 font-display text-lg text-gray-100 sm:text-xl">
          <span lang="hi">आज website बनाते हैं</span>
          <ArrowRight size={18} strokeWidth={1.5} className="text-gray-500" aria-label="becomes" />
          <span>aaj website <span className="lit-word">banate</span> hain</span>
        </p>
      </div>

      <ul className="mt-4 grid gap-x-12 sm:grid-cols-2">
        {POINTS.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex gap-4 border-b border-border py-6">
            <Icon {...ICON} />
            <div>
              <h3 className="text-base font-medium text-gray-100">{title}</h3>
              <p className="mt-1 text-sm leading-6 text-gray-400">{body}</p>
            </div>
          </li>
        ))}
      </ul>
      </Reveal>
    </section>
  );
}

const STEPS: [string, string][] = [
  ['Upload video', 'Job queue in SQLite'],
  ['Extract audio', 'FFmpeg, 16 kHz audio and cleanup'],
  ['Find speech', 'Silero VAD speech windows'],
  ['Recognise words', 'Faster Whisper, per-window Hindi/English'],
  ['Align to audio', 'WhisperX wav2vec2 alignment'],
  ['Map to Hinglish', 'Qwen via Ollama, word-by-word mapping'],
  ['Caption document', 'Words, timing and style'],
  ['Caption studio', 'Edit, style, position'],
  ['Export', 'FFmpeg + libass, MP4 / SRT / VTT'],
];

const STACK: [string, string][] = [
  ['Web app', 'Next.js 14 App Router, React 18, Tailwind CSS'],
  ['Worker', 'Node.js job runner polling Prisma, one job at a time'],
  ['Data', 'Prisma + SQLite, PostgreSQL-ready schema'],
  ['Storage', 'Local filesystem or any S3-compatible store'],
  ['Speech', 'faster-whisper 1.2.1, Silero VAD, WhisperX 3.8.6'],
  ['Hinglish', 'Qwen 3.5 9B via Ollama, one-word keyed mappings, rules fallback'],
  ['Video', 'FFmpeg / ffprobe, libass, bundled OFL fonts (Latin + Devanagari)'],
  ['Tests', 'Vitest, Python unittest, Playwright'],
];

export function HowItWorks() {
  return (
    <section id="how" className={SECTION}>
      <Reveal>
      <h2 className={SECTION_TITLE}>How it works</h2>
      <p className={SECTION_LEDE}>
        One local pipeline from upload to export. A worker picks up each job and runs every step on your machine.
      </p>

      <Pipeline steps={STEPS} />

      <h3 className="mt-16 font-display text-xl font-medium text-gray-100">Stack</h3>
      <dl className="mt-4 divide-y divide-border rounded-2xl border border-border bg-surface">
        {STACK.map(([layer, tech]) => (
          <div key={layer} className="grid gap-1 px-6 py-4 sm:grid-cols-4 sm:gap-6">
            <dt className="text-sm text-gray-500">{layer}</dt>
            <dd className="text-sm text-gray-100 sm:col-span-3">{tech}</dd>
          </div>
        ))}
      </dl>
      </Reveal>
    </section>
  );
}

const FIGURE = 'font-display text-4xl font-medium tabular-nums text-gray-100';
const PANEL = 'rounded-2xl border border-border bg-surface p-6';

function Stat({ label, figure, context, className = '' }: { label: string; figure: React.ReactNode; context: string; className?: string }) {
  return (
    <div className={`${PANEL} ${className}`}>
      <p className="text-sm text-gray-400">{label}</p>
      <p className={`mt-3 ${FIGURE}`}>{figure}</p>
      <p className="mt-3 text-sm leading-6 text-gray-500">{context}</p>
    </div>
  );
}

export function ProofSection() {
  return (
    <section id="proof" className={SECTION}>
      <Reveal>
      <h2 className={SECTION_TITLE}>Measured, not promised</h2>
      <p className={SECTION_LEDE}>
        Recognition figures come from a sample project after vocabulary hints. Render figures come from an automated check that compares the browser preview with the FFmpeg export.
      </p>

      <div className="mt-12 grid gap-4 lg:grid-cols-3">
        <div className={`${PANEL} lg:col-span-2`}>
          <p className="text-sm text-gray-400">Words force-aligned to audio</p>
          <p className="mt-3 flex flex-wrap items-baseline gap-x-4">
            <span className={`${FIGURE} sm:text-6xl`}><CountUp value={238} /><span className="text-gray-500"> / 265</span></span>
            <span className="font-display text-2xl font-medium tabular-nums text-gray-400">89.8%</span>
          </p>
          <p className="mt-3 text-sm leading-6 text-gray-500">
            126.85-second Hinglish gaming tutorial. The other 27 words keep estimated timing and are flagged for review.
          </p>
        </div>
        <Stat label="Render checks passed" figure={<><CountUp value={120} /><span className="text-gray-500"> / 120</span></>} context="40 templates × Roman, mixed, Devanagari" />
        <Stat label="Largest preview vs export difference" figure={<><CountUp value={21} /><span className="text-gray-500"> px</span></>} context="Caption bounding box on a 640×360 frame, across all 120 cases" />
        <Stat label="Non-Roman letters left in Hinglish captions" figure={<CountUp value={0} />} context="126.85-second Hinglish gaming tutorial" />
        <div className={PANEL}>
          <p className="text-sm text-gray-400">Test suite</p>
          <ul className="mt-3 space-y-2 text-sm tabular-nums text-gray-100">
            <li>90 unit tests</li>
            <li>5 browser groups, desktop and mobile</li>
            <li>120 render checks</li>
          </ul>
        </div>
      </div>
      </Reveal>
    </section>
  );
}

const REQUIREMENTS: [string, string?][] = [
  ['Node.js 20+ and npm'],
  ['FFmpeg and ffprobe on PATH'],
  ['Python 3.11.9', 'For local speech recognition'],
  ['Ollama with qwen3.5:9b', 'Optional. A rules-based Hinglish mode works without it'],
];

function CommandBlock({ label, lines }: { label: string; lines: string[] }) {
  return (
    <div>
      <p className="mb-2 text-sm text-gray-400">{label}</p>
      <div className="flex items-start gap-2 rounded-xl border border-border bg-bg py-2 pl-4 pr-2">
        <pre className="min-w-0 flex-1 overflow-x-auto py-2 font-mono text-sm leading-6 text-gray-100">{lines.join('\n')}</pre>
        <CopyButton text={lines.join('\n')} />
      </div>
    </div>
  );
}

export function GetStarted() {
  return (
    <section id="start" className={SECTION}>
      <Reveal>
      <h2 className={SECTION_TITLE}>Get started</h2>
      <p className={SECTION_LEDE}>LoCap runs on one machine. Install the requirements, set up the database, then start the app.</p>

      <div className="mt-12 grid gap-12 lg:grid-cols-2">
        <div>
          <h3 className="font-display text-xl font-medium text-gray-100">Requirements</h3>
          <ul className="mt-4 divide-y divide-border border-y border-border">
            {REQUIREMENTS.map(([item, note]) => (
              <li key={item} className="py-4">
                <p className="text-sm text-gray-100">{item}</p>
                {note && <p className="mt-1 text-sm text-gray-500">{note}</p>}
              </li>
            ))}
          </ul>
          <a href={REPO_URL} className="btn btn-secondary mt-8 min-h-12 px-5" target="_blank" rel="noreferrer">
            <GithubMark />
            Read the full setup on GitHub
          </a>
        </div>

        <div className="min-w-0 space-y-6">
          <CommandBlock label="Install" lines={['npm install', 'cp .env.example .env', 'npm run db:setup']} />
          <CommandBlock label="Run" lines={['npm run dev']} />
          <p className="text-sm leading-6 text-gray-400">
            Open <span className="font-mono text-gray-100">http://localhost:3000</span>. The web app and the worker start together.
          </p>
        </div>
      </div>
      </Reveal>
    </section>
  );
}

const PLANS: { title: string; status: string; body: string }[] = [
  { title: 'Accuracy benchmark and GPU acceleration', status: 'Designed, on hold', body: 'Word-error-rate scoring against hand-corrected references, CUDA float16 recognition and alignment, and benchmark-driven model choice including Hindi-tuned checkpoints.' },
  { title: 'Hindi (Devanagari) output', status: 'Planned', body: 'Devanagari captions and a one-click Hinglish ↔ हिंदी switch in the studio.' },
  { title: 'Uncertain-word review', status: 'Planned', body: 'Jump through low-confidence words and play each one in place.' },
];

export function Roadmap() {
  return (
    <section id="roadmap" className={SECTION}>
      <Reveal>
      <h2 className={SECTION_TITLE}>Roadmap</h2>
      <p className={SECTION_LEDE}>
        LoCap runs as a single-machine local application. Authentication is a local demo-user shortcut, not production login. Recognition quality depends on audio, and names or fast code-switches can still need a quick review in the studio.
      </p>

      <ul className="mt-12 divide-y divide-border border-y border-border">
        {PLANS.map(plan => (
          <li key={plan.title} className="grid gap-2 py-6 sm:grid-cols-4 sm:gap-6">
            <p className="text-sm text-gray-500">{plan.status}</p>
            <div className="sm:col-span-3">
              <h3 className="text-base font-medium text-gray-100">{plan.title}</h3>
              <p className="mt-1 text-sm leading-6 text-gray-400">{plan.body}</p>
            </div>
          </li>
        ))}
      </ul>
      </Reveal>
    </section>
  );
}

const FOOTER_LINKS = [
  { href: '#why', label: 'Why LoCap' },
  { href: '#templates', label: 'Templates' },
  { href: '#start', label: 'Get started' },
];

export function LaunchFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-12 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Logo />
          <p className="mt-4 max-w-md text-sm leading-6 text-gray-500">
            Copyright © 2026 Karthik Shakyawar. All rights reserved. Source published for viewing only.
          </p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap items-center gap-1">
          {FOOTER_LINKS.map(link => (
            <a key={link.href} href={link.href} className="flex h-9 items-center rounded-lg px-3 text-sm text-gray-400 transition-colors hover:bg-surface2 hover:text-gray-100">{link.label}</a>
          ))}
          <a href={REPO_URL} target="_blank" rel="noreferrer" className="flex h-9 items-center gap-2 rounded-lg px-3 text-sm text-gray-400 transition-colors hover:bg-surface2 hover:text-gray-100">
            <GithubMark />
            GitHub
          </a>
        </nav>
      </div>
      <FooterWordmark />
    </footer>
  );
}
