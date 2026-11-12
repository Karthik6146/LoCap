'use client';
import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';

const ease = [0.22, 1, 0.36, 1] as const;

export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  // Same element on server and client: swapping to a plain div under reduced motion would hydrate against
  // the server's opacity:0 style, which React 18 does not patch, so reduced motion gets an instant reveal instead.
  return <motion.div className={className} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }}
    transition={reduce ? { duration: 0 } : { duration: 0.5, ease, delay }}>{children}</motion.div>;
}
