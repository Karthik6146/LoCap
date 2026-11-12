'use client';
import { useEffect, useRef, type PointerEvent, type ReactNode } from 'react';
import { motion, useReducedMotion, useSpring } from 'motion/react';

const MAX_DEG = 4;
// Damping ratio ~0.98: settles without a visible bounce.
const SPRING = { stiffness: 150, damping: 24 };

// Entrance is CSS so the server HTML is never stuck hidden before hydration.
const CSS = `
@keyframes locap-card-in { from { opacity: 0; transform: translate3d(0,24px,0); } }
.locap-card-in { animation: locap-card-in 600ms cubic-bezier(0.22,1,0.36,1) 300ms both; }
@media (prefers-reduced-motion: reduce) { .locap-card-in { animation: none; } }
`;

export function TiltCard({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const enabled = useRef(false);
  const rotateX = useSpring(0, SPRING);
  const rotateY = useSpring(0, SPRING);

  useEffect(() => {
    const fine = window.matchMedia('(pointer: fine)');
    const update = () => {
      enabled.current = fine.matches && !reduced;
      if (!enabled.current) {
        rotateX.set(0);
        rotateY.set(0);
      }
    };
    update();
    fine.addEventListener('change', update);
    return () => fine.removeEventListener('change', update);
  }, [reduced, rotateX, rotateY]);

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!enabled.current) return;
    const r = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width - 0.5;
    const ny = (e.clientY - r.top) / r.height - 0.5;
    rotateY.set(nx * 2 * MAX_DEG);
    rotateX.set(-ny * 2 * MAX_DEG);
  };
  const onLeave = () => {
    rotateX.set(0);
    rotateY.set(0);
  };

  return (
    <div className="locap-card-in min-w-0" style={{ perspective: 1000 }} onPointerMove={onMove} onPointerLeave={onLeave}>
      <style>{CSS}</style>
      <motion.div className="rounded-2xl shadow-[0_24px_48px_-24px_rgba(0,0,0,0.6)]" style={{ rotateX, rotateY }}>
        {children}
      </motion.div>
    </div>
  );
}
