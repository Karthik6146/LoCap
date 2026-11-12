'use client';
import type { ReactNode } from 'react';

// CSS keyframes, not motion `initial`: the server HTML animates on first paint without waiting
// for hydration, ends in the final state without JS, and reduced motion skips straight to it.
const EASE = 'cubic-bezier(0.22,1,0.36,1)';
const WORDS = ['Captions', 'that', 'keep', 'up', 'with'];
const STAGGER = 60;
const RISE = 500;
const LANDED = WORDS.length * STAGGER + RISE; // "Hinglish" is word index WORDS.length
const WIPE = 400;
const FADE_AT = LANDED + WIPE - 100;

const CSS = `
@keyframes locap-rise { from { transform: translate3d(0,calc(100% + 0.15em),0); } }
@keyframes locap-wipe { from { transform: scaleX(0); } }
@keyframes locap-fade { from { opacity: 0; transform: translate3d(0,8px,0); } }
.locap-rise { animation: locap-rise ${RISE}ms ${EASE} both; }
.locap-wipe { animation: locap-wipe ${WIPE}ms ${EASE} ${LANDED}ms both; }
.locap-fade { animation: locap-fade 400ms ${EASE} ${FADE_AT}ms both; }
@media (prefers-reduced-motion: reduce) { .locap-rise, .locap-wipe, .locap-fade { animation: none; } }
`;

// Room for descenders inside the clip without changing line height.
const CLIP = { paddingBottom: '0.15em', marginBottom: '-0.15em' };

function Word({ index, children }: { index: number; children: ReactNode }) {
  return (
    <span className="inline-block overflow-hidden align-top" style={CLIP}>
      <span className="locap-rise inline-block" style={{ animationDelay: `${index * STAGGER}ms` }}>
        {children}
      </span>
    </span>
  );
}

/** Kicker and h1 with the staggered entrance. `children` (body copy, CTAs) fade in after the headline. */
export function HeroHeadline({ children }: { children?: ReactNode }) {
  return (
    <>
      <style>{CSS}</style>
      <p className="locap-fade kicker mb-4">Local-first captions for Hindi, English and Hinglish</p>
      <h1 className="font-display text-5xl font-medium leading-[1.05] tracking-[-0.03em] text-gray-100 sm:text-6xl">
        {WORDS.map((w, i) => (
          <span key={w}>
            <Word index={i}>{w}</Word>{' '}
          </span>
        ))}
        <Word index={WORDS.length}>
          {/* bg-transparent: the mint comes from the wiping layer behind the text. */}
          <span className="lit-word relative isolate inline-block bg-transparent px-2 pb-1 leading-none">
            <span aria-hidden="true" className="locap-wipe absolute inset-0 -z-10 origin-left rounded bg-primary" />
            Hinglish
          </span>
        </Word>
      </h1>
      {children && <div className="locap-fade">{children}</div>}
    </>
  );
}
