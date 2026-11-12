'use client';
import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'motion/react';

const FONT = '"Inter","Noto Sans Devanagari",sans-serif';

const PAIRS: [string, string][] = [
  ['नमस्ते', 'namaste'], ['दोस्तों', 'doston'], ['आज', 'aaj'], ['वीडियो', 'video'], ['बनाते', 'banate'],
  ['हैं', 'hain'], ['देखो', 'dekho'], ['शुरू', 'shuru'], ['करते', 'karte'], ['चलो', 'chalo'],
  ['नया', 'naya'], ['कुछ', 'kuch'], ['सब', 'sab'], ['अच्छा', 'accha'], ['बहुत', 'bahut'],
  ['ज़रूर', 'zaroor'], ['पहले', 'pehle'], ['बिना', 'bina'],
];
const ENGLISH = ['website', 'search bar', 'Minecraft'];

// [font size px, loop seconds]; odd rows drift the other way.
const ROW_SPECS = [[44, 70], [30, 48], [56, 90], [34, 56], [48, 78], [28, 42], [40, 64], [52, 84]];
const PER_ROW = 22;

// Fixed-seed LCG so server and client markup match.
const ROWS = (() => {
  let seed = 11;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length)]!;
  return ROW_SPECS.map(([size, secs]) => ({
    size,
    secs,
    words: Array.from({ length: PER_ROW }, () => {
      if (rand() < 0.1) return pick(ENGLISH);
      const [hi, en] = pick(PAIRS);
      return rand() < 0.5 ? hi : en;
    }),
  }));
})();

const LIT_MS = 700; // on-time; with the 500ms opacity transition each word reads ~1.2s
const CSS = `
@keyframes locap-drift { to { transform: translate3d(-50%,0,0); } }
.locap-art-row { animation: locap-drift linear infinite paused; }
.locap-art[data-run] .locap-art-row { animation-play-state: running; will-change: transform; }
.locap-art {
  -webkit-mask-image: linear-gradient(to right, transparent, #000 15%, #000 85%, transparent), linear-gradient(to bottom, rgb(0 0 0 / .2), rgb(0 0 0 / .2) 45%, #000 75%, transparent);
  mask-image: linear-gradient(to right, transparent, #000 15%, #000 85%, transparent), linear-gradient(to bottom, rgb(0 0 0 / .2), rgb(0 0 0 / .2) 45%, #000 75%, transparent);
  -webkit-mask-composite: source-in;
  mask-composite: intersect;
}
@media (min-width: 1024px) {
  .locap-art {
    -webkit-mask-image: linear-gradient(to right, transparent 20%, rgb(0 0 0 / .1) 40%, #000 65%, #000 88%, transparent), linear-gradient(to bottom, transparent, #000 18%, #000 82%, transparent);
    mask-image: linear-gradient(to right, transparent 20%, rgb(0 0 0 / .1) 40%, #000 65%, #000 88%, transparent), linear-gradient(to bottom, transparent, #000 18%, #000 82%, transparent);
  }
}
`;

/** True when nothing opaque (the demo card, the header) or readable sits over this point. */
function uncovered(x: number, y: number, stop: Element | null) {
  const hit = document.elementFromPoint(x, y);
  if (!hit || !stop || !stop.contains(hit)) return false;
  for (let n: Element | null = hit; n && n !== stop; n = n.parentElement) {
    if (n.matches('p,h1,h2,a,button') || getComputedStyle(n).backgroundColor !== 'rgba(0, 0, 0, 0)') return false;
  }
  return true;
}

export function HeroArt() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const root = ref.current;
    if (!root || reduced) return;
    const words = root.querySelectorAll<HTMLElement>('[data-w]');
    const wide = window.matchMedia('(min-width: 1024px)');
    const lit: HTMLElement[] = [];
    const offTimers = new Set<number>();
    let onScreen = false;
    let timer = 0;

    const unlight = (el: HTMLElement) => {
      el.removeAttribute('data-lit');
      const i = lit.indexOf(el);
      if (i >= 0) lit.splice(i, 1);
    };

    const light = () => {
      const box = root.getBoundingClientRect();
      for (let tries = 0; tries < 12; tries++) {
        const el = words[Math.floor(Math.random() * words.length)]!;
        if (el.hasAttribute('data-lit')) continue;
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const fx = (cx - box.left) / box.width;
        const fy = (cy - box.top) / box.height;
        // Keep the left text column calm on wide layouts.
        if (fx < (wide.matches ? 0.55 : 0.1) || fx > 0.92 || fy < 0.12 || fy > 0.88) continue;
        if (!uncovered(cx, cy, root.parentElement)) continue;
        if (lit.length >= 2) unlight(lit[0]!);
        el.setAttribute('data-lit', '');
        lit.push(el);
        const off = window.setTimeout(() => {
          offTimers.delete(off);
          unlight(el);
        }, LIT_MS);
        offTimers.add(off);
        return;
      }
    };

    const tick = () => {
      light();
      timer = window.setTimeout(tick, 600 + Math.random() * 300);
    };

    const sync = () => {
      const run = onScreen && !document.hidden;
      root.toggleAttribute('data-run', run);
      window.clearTimeout(timer);
      if (run) timer = window.setTimeout(tick, 600);
    };

    const io = new IntersectionObserver(entries => {
      onScreen = entries.some(e => e.isIntersecting);
      sync();
    });
    io.observe(root);
    document.addEventListener('visibilitychange', sync);

    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', sync);
      window.clearTimeout(timer);
      offTimers.forEach(t => window.clearTimeout(t));
      [...lit].forEach(unlight);
      root.removeAttribute('data-run');
    };
  }, [reduced]);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="locap-art pointer-events-none absolute inset-0 flex opacity-50 lg:opacity-100 select-none flex-col justify-evenly overflow-hidden"
      style={{ fontFamily: FONT }}
    >
      <style>{CSS}</style>
      {ROWS.map((row, i) => (
        <div
          key={i}
          className="locap-art-row flex w-max shrink-0 leading-tight text-gray-800"
          style={{ fontSize: row.size, animationDuration: `${row.secs}s`, animationDirection: i % 2 ? 'reverse' : 'normal' }}
        >
          {/* Content twice so translateX(-50%) loops seamlessly. */}
          {[...row.words, ...row.words].map((w, j) => (
            <span
              key={j}
              data-w={w}
              className="relative mr-12 whitespace-nowrap before:absolute before:inset-y-0 before:-inset-x-1.5 before:rounded before:bg-primary/15 before:opacity-0 before:transition-opacity before:duration-500 before:content-[''] after:absolute after:inset-0 after:text-gray-300 after:opacity-0 after:transition-opacity after:duration-500 after:content-[attr(data-w)] data-[lit]:before:opacity-100 data-[lit]:after:opacity-100"
            >
              {w}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
