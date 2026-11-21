'use client';
import { useEffect, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'motion/react';

const ease = [0.22, 1, 0.36, 1] as const;
const LETTERS = ['L', 'o', 'C', 'a', 'p'];
const STEP = 120;
const EVERY = 6000;

/** Footer art: a clipped "LoCap" wordmark with a karaoke sweep, one lit letter at a time. */
export function FooterWordmark() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.3 });
  const reduce = useReducedMotion();
  const [hidden, setHidden] = useState(false);
  const [lit, setLit] = useState(-1);
  const active = inView && !hidden && !reduce;

  useEffect(() => {
    const sync = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);

  // Sweep on entering view, then every 6 s; index LETTERS.length means none lit.
  useEffect(() => {
    if (!active) return;
    let i = 0;
    let id = 0;
    const tick = () => {
      setLit(i);
      id = window.setTimeout(tick, i < LETTERS.length ? STEP : EVERY - LETTERS.length * STEP);
      i = i < LETTERS.length ? i + 1 : 0;
    };
    tick();
    return () => { window.clearTimeout(id); setLit(-1); };
  }, [active]);

  return <div ref={ref} aria-hidden="true" className="mx-auto max-w-6xl select-none overflow-hidden px-6 text-center">
    <p className="translate-y-1/4 whitespace-nowrap font-display text-[clamp(96px,24vw,432px)] font-medium leading-[0.8] tracking-tighter text-surface3">
      {LETTERS.map((letter, i) => <motion.span key={i} initial={false}
        animate={{ color: lit === i ? 'var(--primary)' : 'var(--surface3)' }} transition={{ duration: STEP / 1000, ease }}>{letter}</motion.span>)}
    </p>
  </div>;
}
