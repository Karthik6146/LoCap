'use client';
import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';

const CAPTION_FONT = '"Inter", "Noto Sans Devanagari", sans-serif';
const PAIRS = [
  ['नमस्ते', 'namaste'], ['दोस्तों', 'doston'], ['आज', 'aaj'], ['वीडियो', 'video'], ['बनाते', 'banate'], ['हैं', 'hain'],
  ['देखो', 'dekho'], ['शुरू', 'shuru'], ['करते', 'karte'], ['चलो', 'chalo'], ['नया', 'naya'], ['कुछ', 'kuch'],
  ['सब', 'sab'], ['अच्छा', 'accha'], ['बहुत', 'bahut'], ['ज़रूर', 'zaroor'], ['पहले', 'pehle'], ['बिना', 'bina'],
] as const;
const LOOP_MS = 48000;
// A word turns Roman this many px before it reaches the band's center, so the morph lands before it lights.
const LEAD_PX = 64;

// Marquee and morph styles. Static string, so server and client markup match.
const CSS = `
@keyframes locap-ticker { to { transform: translateX(-50%); } }
.tk-band { -webkit-mask-image: linear-gradient(to right, transparent, #000 12%, #000 88%, transparent); mask-image: linear-gradient(to right, transparent, #000 12%, #000 88%, transparent); }
.tk-run { animation: locap-ticker ${LOOP_MS}ms linear infinite; }
.tk-band:hover .tk-run { animation-play-state: paused; }
.tk-cell { display: grid; justify-items: center; }
.tk-cell span { grid-area: 1 / 1; transition: opacity .3s var(--ease), transform .3s var(--ease), filter .3s var(--ease); }
.tk-cell .tk-en { opacity: 0; transform: translateY(8px); }
.tk-cell[data-roman] .tk-hi { opacity: 0; transform: translateY(-8px); filter: blur(4px); }
.tk-cell[data-roman] .tk-en { opacity: 1; transform: none; }
[data-instant] .tk-cell span { transition: none; }
`;

const Dot = () => <span className="size-1 shrink-0 rounded-full bg-gray-600" />;

export function ScriptTicker() {
  const reduce = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const bandRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  // Gate on mount: the server cannot know the motion preference, and pre-JS markup stays static Devanagari.
  const still = mounted && reduce;
  const running = mounted && !reduce;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const band = bandRef.current;
    const track = trackRef.current;
    if (!running || !band || !track) return;
    const anim = track.getAnimations()[0];
    if (!anim) return;

    const words = Array.from(track.querySelectorAll<HTMLElement>('.tk-cell'), cell => ({
      cell, en: cell.querySelector<HTMLElement>('.tk-en')!, center: 0, half: 0, roman: false, lit: false,
    }));
    let loopWidth = 0;
    let mid = 0;
    let last = 0;
    let raf = 0;
    let inView = false;

    const measure = () => {
      loopWidth = track.offsetWidth / 2;
      mid = band.clientWidth / 2;
      for (const w of words) { w.half = w.cell.offsetWidth / 2; w.center = w.cell.offsetLeft + w.half; }
    };

    // Each word's position comes from the CSS animation's clock; only words whose state changes are touched.
    const frame = () => {
      const p = (Number(anim.currentTime) % LOOP_MS) / LOOP_MS;
      // On loop restart the first copy takes over from the second: swap states without a visible morph.
      const wrapped = p < last;
      last = p;
      if (wrapped) track.dataset.instant = '';
      const shift = p * loopWidth;
      for (const w of words) {
        const x = w.center - shift;
        const roman = x < mid + LEAD_PX;
        const lit = Math.abs(x - mid) < w.half;
        if (roman !== w.roman) { w.roman = roman; w.cell.toggleAttribute('data-roman', roman); }
        if (lit !== w.lit) {
          w.lit = lit;
          w.en.classList.toggle('lit-word', lit);
          w.en.classList.toggle('text-gray-100', !lit);
        }
      }
      if (wrapped) { void track.offsetWidth; delete track.dataset.instant; }
      raf = requestAnimationFrame(frame);
    };

    const sync = () => {
      const on = inView && !document.hidden;
      track.style.animationPlayState = on ? '' : 'paused';
      cancelAnimationFrame(raf);
      raf = on ? requestAnimationFrame(frame) : 0;
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(band);
    ro.observe(track);
    const io = new IntersectionObserver(entries => { inView = entries.some(e => e.isIntersecting); sync(); });
    io.observe(band);
    document.addEventListener('visibilitychange', sync);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', sync);
    };
  }, [running]);

  return (
    <div ref={bandRef} className="tk-band relative flex h-20 items-center overflow-hidden border-y border-border bg-surface" style={{ fontFamily: CAPTION_FONT }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <p className="sr-only">Examples of Hindi words LoCap converts to Hinglish: {PAIRS.map(p => p[1]).join(', ')}.</p>
      {still ? (
        <div aria-hidden="true" className="flex w-full justify-center gap-8 px-6 text-xl sm:text-2xl">
          {PAIRS.slice(0, 5).map(([hi, en], i) => (
            <span key={en} className={`items-center gap-8 ${i > 2 ? 'hidden sm:flex' : 'flex'}`}>
              {i > 0 && <Dot />}
              <span className="whitespace-nowrap text-gray-400">{hi} <span className="text-gray-100">{en}</span></span>
            </span>
          ))}
        </div>
      ) : (
        <div ref={trackRef} aria-hidden="true" className={`relative flex w-max text-xl leading-normal text-gray-400 sm:text-2xl ${running ? 'tk-run' : ''}`}>
          {[0, 1].flatMap(copy => PAIRS.map(([hi, en]) => (
            <span key={`${copy}-${en}`} className="flex items-center gap-8 pr-8">
              <span className="tk-cell whitespace-nowrap">
                <span className="tk-hi px-1">{hi}</span>
                <span className="tk-en px-1 text-gray-100">{en}</span>
              </span>
              <Dot />
            </span>
          )))}
        </div>
      )}
    </div>
  );
}
