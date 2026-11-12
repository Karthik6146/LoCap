'use client';
import { memo, useEffect, useState } from 'react';
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'motion/react';

const EASE = [0.22, 1, 0.36, 1] as const;
const CAPTION_FONT = '"Inter", "Noto Sans Devanagari", sans-serif';

// Word times are in media seconds on a 3s clip.
const MEDIA = 3;
const WORDS = [
  { hi: 'आज', en: 'aaj', start: 0.2, end: 0.6 },
  { hi: 'website', en: 'website', start: 0.7, end: 1.5 },
  { hi: 'बनाते', en: 'banate', start: 1.6, end: 2.2 },
  { hi: 'हैं', en: 'hain', start: 2.3, end: 2.8 },
];

// Loop clock, ms: recognized 0-1800, Hinglish swaps 1800-3900, karaoke 3900-6900, hold until 7600.
const CONVERT_AT = 1800;
const SWAP_AT = 2000;
const SWAP_GAP = 500;
const KARAOKE_AT = 3900;
const LOOP = 7600;
const BUILD_GAP = 300;
const SCENE_STEPS = 10;
const STATIC_T = KARAOKE_AT + 1800; // reduced motion: 1.8s into playback, banate lit

// Deterministic waveform (fixed-seed LCG) so server and client markup match.
const BARS = (() => {
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  return Array.from({ length: 64 }, (_, i) => {
    const at = ((i + 0.5) / 64) * MEDIA;
    const speech = WORDS.some(w => at >= w.start && at < w.end);
    return Math.round((speech ? 0.4 + 0.6 * rand() : 0.1 + 0.15 * rand()) * 100);
  });
})();

const STATUS = ['Hindi + English detected', 'Converting to Hinglish', '4 words aligned'];

export function HeroDemo() {
  const reduced = useReducedMotion();
  const [{ t, cycle }, setClock] = useState({ t: 0, cycle: 0 });

  // One clock for everything. Started after mount so SSR and first client render match at t=0.
  useEffect(() => {
    if (reduced) {
      setClock({ t: STATIC_T, cycle: 0 });
      return;
    }
    let raf = 0;
    let last = 0;
    let time = 0;
    let loops = 0;
    const tick = (now: number) => {
      if (last) time += Math.min(now - last, 100);
      last = now;
      if (time >= LOOP) {
        time = 0;
        loops += 1;
      }
      setClock({ t: time, cycle: loops });
      raf = requestAnimationFrame(tick);
    };
    const start = () => {
      last = 0;
      raf = requestAnimationFrame(tick);
    };
    const stop = () => cancelAnimationFrame(raf);
    const onVisibility = () => (document.hidden ? stop() : start());
    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [reduced]);

  const phase = t < CONVERT_AT ? 0 : t < KARAOKE_AT ? 1 : 2;
  const media = Math.min(Math.max((t - KARAOKE_AT) / 1000, 0), MEDIA);
  const playing = t >= KARAOKE_AT && media < MEDIA;
  // Last word that has started stays lit through the gap, like a real karaoke caption.
  const active = playing ? WORDS.reduce((a, w, i) => (media >= w.start ? i : a), -1) : -1;
  // Words 0..swapped-1 show their Roman form; website maps to itself.
  const swapped = Math.min(Math.max(Math.floor((t - SWAP_AT) / SWAP_GAP) + 1, 0), WORDS.length);
  const built = Math.min(Math.floor(t / BUILD_GAP), SCENE_STEPS);
  const progress = media / MEDIA;

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-w-0">
        <p className="sr-only">
          Demo: the Hindi line आज website बनाते हैं becomes the Hinglish caption aaj website banate hain, timed word by word.
        </p>
        <div aria-hidden="true" className="overflow-hidden rounded-2xl border border-border bg-surface">
          <div className="relative aspect-video bg-[#0b0b0c]">
            <BrowserScene built={built} />
            <Caption cycle={cycle} swapped={swapped} active={active} />
          </div>

          <div className="border-t border-border px-3 py-3 sm:px-4 sm:py-4">
            <div className="relative">
              <div className="flex h-8 items-center gap-px sm:h-10">
                {BARS.map((h, i) => (
                  <div
                    key={i}
                    className={`flex-1 rounded-full ${(i + 0.5) / BARS.length <= progress ? 'bg-gray-400' : 'bg-gray-700'}`}
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={cycle}
                  className="relative mt-2 h-5 sm:h-6"
                  exit={{ opacity: 0, filter: 'blur(2px)' }}
                  transition={{ ease: EASE, duration: 0.2 }}
                >
                  {WORDS.map((w, i) => (
                    <motion.div
                      key={i}
                      className={`absolute inset-y-0 flex items-center overflow-hidden rounded-md px-1 text-xs ${
                        i === active ? 'lit-word font-medium' : 'bg-surface3 text-gray-400'
                      }`}
                      style={{ left: `${(w.start / MEDIA) * 100}%`, width: `${((w.end - w.start) / MEDIA) * 100}%`, fontFamily: CAPTION_FONT }}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ ease: EASE, duration: 0.3, delay: 0.15 + i * 0.05 }}
                    >
                      <span className="hidden truncate sm:block">{i < swapped ? w.en : w.hi}</span>
                    </motion.div>
                  ))}
                </motion.div>
              </AnimatePresence>

              {/* Full-width layer so translateX(%) maps to track position. */}
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute inset-0" style={{ transform: `translateX(${progress * 100}%)` }}>
                  <div className="h-full w-px bg-gray-100" />
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3 text-xs tabular-nums">
              <span className="font-mono text-gray-400">
                {`00:${media.toFixed(1).padStart(4, '0')}`}
                <span className="text-gray-500"> / 00:03.0</span>
              </span>
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={phase}
                  className="truncate text-gray-500"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ ease: EASE, duration: 0.2 }}
                >
                  {STATUS[phase]}
                </motion.span>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </MotionConfig>
  );
}

/** Burned-in caption. Memoized on its discrete inputs so the per-frame clock does not re-measure layout. */
const Caption = memo(function Caption({ cycle, swapped, active }: { cycle: number; swapped: number; active: number }) {
  return (
    <div className="absolute inset-x-0 bottom-3 flex justify-center px-4 sm:bottom-6">
      <AnimatePresence mode="wait">
        <motion.p
          key={cycle}
          className="flex flex-wrap justify-center text-base font-bold leading-normal text-white sm:text-xl lg:text-2xl"
          style={{ fontFamily: CAPTION_FONT, textShadow: '0 1px 2px rgb(0 0 0 / 0.9), 0 2px 8px rgb(0 0 0 / 0.6)' }}
          exit={{ opacity: 0, y: -6, filter: 'blur(4px)' }}
          transition={{ ease: EASE, duration: 0.3 }}
        >
          {WORDS.map((w, i) => {
            const text = i < swapped ? w.en : w.hi;
            return (
              <motion.span key={i} layout="position" className="inline-grid" transition={{ ease: EASE, duration: 0.3 }}>
                <AnimatePresence>
                  <motion.span
                    key={text}
                    className={`col-start-1 row-start-1 px-1 ${i === active ? 'lit-word' : ''}`}
                    style={i === active ? { textShadow: 'none' } : undefined}
                    initial={{ opacity: 0, y: 8, filter: 'blur(0px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
                    transition={{ ease: EASE, duration: 0.4, delay: text === w.hi ? 0.1 + i * 0.05 : 0.06 }}
                  >
                    {text}
                  </motion.span>
                </AnimatePresence>
              </motion.span>
            );
          })}
        </motion.p>
      </AnimatePresence>
    </div>
  );
});

const fade = (shown: boolean) => ({ opacity: shown ? 1 : 0, y: shown ? 0 : 4 });

/** The video content: a browser window being built, one block per step. Memoized on the step count. */
const BrowserScene = memo(function BrowserScene({ built }: { built: number }) {
  const step = (i: number) => ({
    initial: false as const,
    animate: fade(built > i),
    transition: { ease: EASE, duration: 0.4 },
  });
  return (
    <div className="absolute inset-x-6 bottom-12 top-3 flex flex-col overflow-hidden rounded-lg border border-border bg-surface sm:inset-x-14 sm:bottom-20 sm:top-6 lg:inset-x-20">
      <div className="flex h-5 shrink-0 items-center gap-1 border-b border-border px-2 sm:h-7 sm:px-3">
        <span className="size-1.5 rounded-full bg-surface3" />
        <span className="size-1.5 rounded-full bg-surface3" />
        <span className="size-1.5 rounded-full bg-surface3" />
        <div className="mx-auto flex h-2.5 w-1/2 items-center rounded bg-surface2 px-1.5 sm:h-3.5">
          <motion.div
            className="h-1 w-2/3 origin-left rounded-full bg-gray-600"
            initial={false}
            animate={{ scaleX: built > 0 ? 1 : 0 }}
            transition={{ ease: EASE, duration: 0.5 }}
          />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 p-3 sm:gap-3 sm:p-5">
        <div className="flex items-center justify-between">
          <motion.div {...step(1)} className="h-1.5 w-8 rounded bg-gray-600" />
          <motion.div {...step(2)} className="flex gap-2">
            <span className="h-1.5 w-5 rounded bg-surface2" />
            <span className="h-1.5 w-5 rounded bg-surface2" />
            <span className="h-1.5 w-5 rounded bg-surface2" />
          </motion.div>
        </div>
        <div className="mt-1 flex flex-col gap-1.5 sm:mt-3 sm:gap-2">
          <motion.div {...step(3)} className="h-2 w-2/3 rounded bg-gray-700 sm:h-3" />
          <motion.div {...step(4)} className="h-2 w-1/2 rounded bg-gray-700 sm:h-3" />
          <motion.div {...step(5)} className="hidden h-1.5 w-2/5 rounded bg-surface2 sm:block" />
          <motion.div {...step(6)} className="mt-1 h-3 w-12 rounded bg-gray-600 sm:h-4 sm:w-16" />
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-3 gap-2 sm:mt-1">
          {[7, 8, 9].map(i => (
            <motion.div key={i} {...step(i)} className="rounded-lg border border-border bg-surface2" />
          ))}
        </div>
      </div>
    </div>
  );
});
