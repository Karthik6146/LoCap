'use client';
import { memo, useEffect, useMemo, useRef, useState, type Dispatch, type KeyboardEvent, type ReactNode, type SetStateAction } from 'react';
import { animate, motion, stagger, useInView, useReducedMotion } from 'motion/react';
import { CAPTION_TEMPLATES, TEMPLATE_CATEGORIES, type CaptionTemplate } from '@clipx/captions';
import { CaptionOverlay } from '@/components/caption-overlay';
import { SECTION, SECTION_LEDE, SECTION_TITLE } from './constants';

const scripts = [
  { id: 'hinglish', label: 'Hinglish', words: ['Aaj', 'kuch', 'naya'] },
  { id: 'hindi', label: 'Hindi', words: ['आज', 'कुछ', 'नया'] },
  { id: 'english', label: 'English', words: ['Something', 'new', 'today'] },
];
const ease = [0.22, 1, 0.36, 1] as const;
// Same sample group as the in-app gallery: three words, 3 s, one word every .8 s.
const timed = (words: string[]) => ({ start: 0, end: 3, words: words.map((text, i) => ({ text, start: .2 + i * .8, end: 1 + i * .8 })) });
type Group = ReturnType<typeof timed>;
const labels = new Map<string, string>(TEMPLATE_CATEGORIES.map(c => [c.id, c.label] as const));
const categories = [
  { id: 'all', label: 'All', count: CAPTION_TEMPLATES.length },
  ...TEMPLATE_CATEGORIES.map(c => ({ ...c, count: CAPTION_TEMPLATES.filter(t => t.category === c.id).length })),
];
// Autoplay spotlight order: a fixed seeded shuffle, so server and client agree.
const ORDER = (() => {
  const ids = CAPTION_TEMPLATES.map(t => t.id);
  let seed = 7;
  for (let i = ids.length - 1; i > 0; i--) { seed = (seed * 16807) % 2147483647; const j = seed % (i + 1); [ids[i], ids[j]] = [ids[j]!, ids[i]!]; }
  return ids;
})();

export function TemplateWall() {
  const [script, setScript] = useState(scripts[0]!);
  const [category, setCategory] = useState('all');
  const [hot, setHot] = useState<string | null>(null);
  const [time, setTime] = useState(0);
  const [step, setStep] = useState(0);
  const [hidden, setHidden] = useState(false);
  const reduce = useReducedMotion();
  const section = useRef<HTMLElement>(null);
  const inView = useInView(section, { amount: .2 });
  const group = useMemo(() => timed(script.words), [script]);
  const visible = category === 'all' ? CAPTION_TEMPLATES : CAPTION_TEMPLATES.filter(t => t.category === category);
  const queue = ORDER.filter(id => visible.some(t => t.id === id));
  // Hover or focus wins; the spotlight runs only in view, on a visible tab, without reduced motion.
  const spot = !hot && !reduce && inView && !hidden ? queue[step % queue.length] ?? null : null;
  const active = hot ?? spot;
  const autoplay = !!spot;

  useEffect(() => {
    const sync = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);

  // One rAF loop for the active tile (hovered, focused or spotlighted); the spotlight advances when its 3 s loop ends.
  useEffect(() => {
    if (!active || reduce) return;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = (now - start) / 1000;
      if (autoplay && t >= 3) { setStep(s => s + 1); return; }
      setTime(t % 3); frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); setTime(0); };
  }, [active, autoplay, step, reduce]);

  return <section ref={section} id="templates" className={SECTION}>
    <h2 className={SECTION_TITLE}>40 templates, every script</h2>
    <p className={SECTION_LEDE}>Each tile is drawn live by the same caption renderer the studio uses. The exported MP4 matches it within 21 px.</p>
    <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
      <Radios label="Template category" items={categories} value={category} onChange={setCategory} track="template-chips"
        item={() => 'template-chip'} render={c => <>{c.label} <span className="tabular-nums text-gray-500">{c.count}</span></>} />
      <Radios label="Preview script" items={scripts} value={script.id} onChange={id => setScript(scripts.find(s => s.id === id)!)} track="flex rounded-xl bg-surface p-1"
        item={on => 'h-8 rounded-lg px-3 text-sm transition-colors ' + (on ? 'bg-surface3 text-gray-100' : 'text-gray-400 hover:text-gray-100')} render={s => s.label} />
    </div>
    <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
      {visible.map((template, i) => {
        const still = template.style.animation === 'typewriter' ? 2.8 : .6;
        const live = active === template.id && !reduce;
        return <Tile key={template.id} template={template} group={group} index={i} reduce={!!reduce} reveal={live} spot={spot === template.id} time={live ? time : still} setHot={setHot} />;
      })}
    </div>
  </section>;
}

const Tile = memo(function Tile({ template, group, index, reduce, reveal, spot, time, setHot }: { template: CaptionTemplate; group: Group; index: number; reduce: boolean; reveal: boolean; spot: boolean; time: number; setHot: Dispatch<SetStateAction<string | null>> }) {
  const frame = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const node = frame.current;
    if (!node) return;
    const observer = new ResizeObserver(() => setWidth(node.clientWidth));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  // Word reveal from the in-app gallery: words rise into place one by one on hover or focus.
  useEffect(() => {
    const root = frame.current?.querySelector<HTMLElement>('[data-caption-overlay]');
    if (!reveal || !root) return;
    // shortcut: borrows CaptionOverlay's unstyled per-word wrappers as the moving layer and clears every inline style after; upgrade to a reveal prop if the overlay grows one.
    const words = Array.from(root.children) as HTMLElement[];
    const reset = () => { root.style.overflow = ''; for (const w of words) { w.style.display = w.style.whiteSpace = w.style.transform = w.style.opacity = ''; } };
    root.style.overflow = 'hidden';
    for (const w of words) { w.style.display = 'inline-block'; w.style.whiteSpace = 'pre'; w.style.transform = 'translateY(100%)'; w.style.opacity = '0'; }
    const controls = animate(words, { y: ['100%', '0%'], opacity: [0, 1] }, { duration: .3, ease, delay: stagger(.05) });
    void controls.then(reset);
    return () => { controls.stop(); reset(); };
  }, [reveal]);
  const enter = () => setHot(template.id);
  const leave = () => setHot(h => (h === template.id ? null : h));
  const { style } = template;
  return <motion.div tabIndex={0} role="group" aria-label={template.name + ' template preview'} className="group min-w-0 rounded-xl"
    onPointerEnter={enter} onPointerLeave={leave} onFocus={enter} onBlur={leave}
    initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }}
    transition={reduce ? { duration: 0 } : { duration: .5, ease, delay: (index % 4) * .06 }}>
    <span ref={frame} aria-hidden="true" className={`relative block aspect-video overflow-hidden rounded-xl border ${spot ? 'border-gray-600' : 'border-border'} bg-[#0b0b0c] transition-colors group-hover:border-gray-700 group-focus-visible:border-gray-700`}>
      {width > 0 && <CaptionOverlay group={group} style={{ ...style, fontSize: 36, stroke: { ...style.stroke, width: style.stroke.width * 36 / style.fontSize }, positionX: .5, positionY: .5 }} time={time} width={320} height={180} scale={width / 320} />}
    </span>
    <p className="mt-3 truncate text-sm font-medium text-gray-100">{template.name}</p>
    <p className="mt-1 text-xs text-gray-500">{labels.get(template.category)}{spot && ' · Playing'}</p>
  </motion.div>;
});

function Radios<T extends { id: string; label: string }>({ label, items, value, onChange, track, item, render }: { label: string; items: T[]; value: string; onChange: (id: string) => void; track: string; item: (on: boolean) => string; render: (x: T) => ReactNode }) {
  const group = useRef<HTMLDivElement>(null);
  function onKey(e: KeyboardEvent, i: number) {
    const next = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: items.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault(); const j = (next + items.length) % items.length;
    onChange(items[j]!.id); (group.current?.children[j] as HTMLElement).focus();
  }
  return <div ref={group} role="radiogroup" aria-label={label} className={track}>{items.map((x, i) => <button type="button" role="radio" key={x.id} aria-checked={value === x.id} tabIndex={value === x.id ? 0 : -1} className={item(value === x.id)} onClick={() => onChange(x.id)} onKeyDown={e => onKey(e, i)}>{render(x)}</button>)}</div>;
}
