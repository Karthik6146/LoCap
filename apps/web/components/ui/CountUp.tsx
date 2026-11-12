'use client';

import { useEffect, useRef } from 'react';
import { animate, useReducedMotion } from 'motion/react';

/** Tweens a whole number from 0 on mount; renders the final value for reduced motion and no-JS. */
export function CountUp({ value, duration = 0.5 }: { value: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    const node = ref.current;
    if (!node || reduce || value === 0) return;
    const controls = animate(0, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: v => { node.textContent = Math.round(v).toLocaleString('en-IN'); },
    });
    return () => controls.stop();
  }, [value, duration, reduce]);
  return <span ref={ref} className="tabular">{value.toLocaleString('en-IN')}</span>;
}
