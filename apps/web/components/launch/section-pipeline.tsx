'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useMotionValueEvent, useReducedMotion, useScroll } from 'motion/react';

type Pt = { x: number; y: number };
type Geo = { w: number; h: number; d: string; stops: number[] };

/* Serpentine on lg: row two runs right to left. Full class names so Tailwind keeps them. */
const ORDER = ['lg:order-1', 'lg:order-2', 'lg:order-3', 'lg:order-6', 'lg:order-5', 'lg:order-4', 'lg:order-7', 'lg:order-8', 'lg:order-9'];
const GUTTER = 16; // row turns run in the ol's lg:px-8 padding, clear of the cards
const RADIUS = 16;
const BARS = [0.5, 0.9, 0.6, 1, 0.7];

/** Path through the marker centres plus each marker's fraction of the total length. */
function buildPath(pts: Pt[], w: number): Pick<Geo, 'd' | 'stops'> {
  const [first, second] = pts;
  if (!first) return { d: '', stops: [] };
  const serpentine = !!second && Math.abs(first.y - second.y) < 1;
  let d = `M${first.x} ${first.y}`;
  let len = 0;
  const at = [0];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    if (serpentine && Math.abs(a.y - b.y) >= 1) {
      const dir = Math.sign(a.x - (pts[i - 2] ?? a).x) || 1;
      const edge = dir > 0 ? w - GUTTER : GUTTER;
      const r = Math.min(RADIUS, (b.y - a.y) / 2);
      const sweep = dir > 0 ? 1 : 0;
      const ex = edge - dir * r;
      d += ` H${ex} A${r} ${r} 0 0 ${sweep} ${edge} ${a.y + r} V${b.y - r} A${r} ${r} 0 0 ${sweep} ${ex} ${b.y} H${b.x}`;
      len += Math.abs(ex - a.x) + Math.PI * r + (b.y - a.y - 2 * r) + Math.abs(ex - b.x);
    } else {
      d += ` L${b.x} ${b.y}`;
      len += Math.hypot(b.x - a.x, b.y - a.y);
    }
    at.push(len);
  }
  return { d, stops: at.map(l => l / (len || 1)) };
}

export function Pipeline({ steps }: { steps: [string, string][] }) {
  const reduce = useReducedMotion();
  const boxRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const markers = useRef<(HTMLSpanElement | null)[]>([]);
  const [geo, setGeo] = useState<Geo | null>(null);
  const [reached, setReached] = useState(0);
  const chipX = useMotionValue(0);
  const chipY = useMotionValue(0);
  const chipOpacity = useMotionValue(0);
  const { scrollYProgress } = useScroll({ target: boxRef, offset: ['start 0.8', 'end 0.6'] });

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const ro = new ResizeObserver(() => {
      const o = box.getBoundingClientRect();
      const pts = markers.current.map(m => {
        const r = m!.getBoundingClientRect();
        return { x: Math.round(r.left - o.left + r.width / 2), y: Math.round(r.top - o.top + r.height / 2) };
      });
      setGeo({ w: o.width, h: o.height, ...buildPath(pts, o.width) });
    });
    ro.observe(box);
    return () => ro.disconnect();
  }, []);

  // Moves the chip through motion values; React re-renders only when the reached count changes.
  const place = (v: number) => {
    const path = pathRef.current;
    if (!path || !geo) return;
    const p = reduce ? 1 : v;
    const pt = path.getPointAtLength(p * path.getTotalLength());
    chipX.set(pt.x);
    chipY.set(pt.y);
    chipOpacity.set(1);
    setReached(geo.stops.filter(s => s <= p + 0.001).length);
  };
  useMotionValueEvent(scrollYProgress, 'change', place);
  useEffect(() => place(scrollYProgress.get()), [geo, reduce]);

  return (
    <div ref={boxRef} className="relative mt-12">
      <svg aria-hidden className="pointer-events-none absolute inset-0 overflow-visible" width={geo?.w ?? 0} height={geo?.h ?? 0} fill="none">
        {geo && (
          <>
            <path ref={pathRef} d={geo.d} className="stroke-gray-800" strokeWidth={1.5} />
            <motion.path d={geo.d} className="stroke-gray-400" strokeWidth={1.5} style={{ pathLength: reduce ? 1 : scrollYProgress }} />
          </>
        )}
      </svg>

      <ol className="relative grid gap-4 lg:grid-cols-3 lg:gap-x-8 lg:gap-y-12 lg:px-8">
        {steps.map(([step, tool], i) => {
          const lit = i < reached;
          return (
            <li key={step} className={`flex items-start gap-4 lg:flex-col ${ORDER[i]}`}>
              <span ref={el => { markers.current[i] = el; }} className="relative mt-6 h-2 w-2 shrink-0 rounded-sm bg-gray-700 lg:ml-5 lg:mt-0">
                <span className={`absolute inset-0 rounded-sm bg-primary transition-opacity duration-300 ${lit ? 'opacity-100' : 'opacity-0'}`} />
              </span>
              <div className="relative flex min-w-0 flex-1 gap-3 rounded-xl border border-border bg-surface p-4 lg:w-full">
                <span aria-hidden className={`pointer-events-none absolute -inset-px rounded-xl border border-gray-700 transition-opacity duration-300 ${lit ? 'opacity-100' : 'opacity-0'}`} />
                <span className="font-mono text-sm tabular-nums text-gray-500">{String(i + 1).padStart(2, '0')}</span>
                <div className="min-w-0">
                  <p className={`text-base font-medium text-gray-100 transition-opacity duration-300 ${lit || !geo ? 'opacity-100' : 'opacity-60'}`}>{step}</p>
                  <p className="mt-1 font-mono text-xs leading-5 text-gray-500">{tool}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {geo && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 z-10 -ml-5 -mt-2 flex h-4 w-10 items-center justify-center gap-0.5 rounded-md border border-border bg-surface3"
          style={{ x: chipX, y: chipY, opacity: chipOpacity }}
        >
          {BARS.map((h, i) => (
            <motion.span
              key={i}
              className="h-2.5 w-0.5 rounded-full bg-gray-400"
              style={{ scaleY: h }}
              animate={reduce ? undefined : { scaleY: [h, 0.3, 1, h] }}
              transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut', delay: i * 0.12 }}
            />
          ))}
        </motion.div>
      )}
    </div>
  );
}
