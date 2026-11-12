'use client';
import { useEffect, useRef, useState } from 'react';
import { animate, motion, stagger } from 'motion/react';
import { Check, Pause, Play } from 'lucide-react';
import { CAPTION_TEMPLATES, TEMPLATE_CATEGORIES, type CaptionTemplate } from '@clipx/captions';
import { CaptionOverlay } from './caption-overlay';

const scripts = [
  { id: 'hinglish', label: 'Hinglish', words: ['Aaj', 'kuch', 'naya'] },
  { id: 'hindi', label: 'Hindi', words: ['आज', 'कुछ', 'नया'] },
  { id: 'english', label: 'English', words: ['Something', 'new', 'today'] },
];
const categoryKey = 'clipx-template-category';
const ease = [0.22, 1, 0.36, 1] as const;
const timed = (words: string[]) => ({ start: 0, end: 3, words: words.map((text, i) => ({ text, start: .2 + i * .8, end: 1 + i * .8 })) });

export function TemplateGallery({ selected, onSelect, templates = CAPTION_TEMPLATES, custom = [], onSelectCustom }: { selected?: string; onSelect: (template: CaptionTemplate) => void; templates?: CaptionTemplate[]; custom?: CaptionTemplate[]; onSelectCustom?: (template: CaptionTemplate) => void }) {
  const [script, setScript] = useState(scripts[0]!);
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => {
    try { const saved = localStorage.getItem(categoryKey); if (saved === 'mine' || TEMPLATE_CATEGORIES.some(c => c.id === saved)) setCategory(saved!); } catch {}
  }, []);
  const [time, setTime] = useState(.6);
  const [playing, setPlaying] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [hot, setHot] = useState<string>();
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { setReducedMotion(preference.matches); if (preference.matches) { setPlaying(false); setTime(.6); } };
    update(); preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (!playing || reducedMotion) return;
    const start = performance.now();
    const timer = setInterval(() => setTime(((performance.now() - start) / 1000) % 3), 40);
    return () => clearInterval(timer);
  }, [playing, reducedMotion]);
  const chips = [{ id: 'all', label: 'All' }, ...TEMPLATE_CATEGORIES, ...(custom.length ? [{ id: 'mine', label: 'My templates' }] : [])];
  const active = chips.some(c => c.id === category) ? category : 'all';
  function choose(id: string) { setCategory(id); try { localStorage.setItem(categoryKey, id); } catch {} }
  const term = query.trim().toLowerCase();
  const labels = new Map<string, string>(TEMPLATE_CATEGORIES.map(c => [c.id, c.label] as const));
  const visible = (active === 'mine' ? custom : active === 'all' ? templates : templates.filter(t => t.category === active))
    .filter(t => !term || [t.name, ...t.tags, labels.get(t.category) ?? ''].some(x => x.toLowerCase().includes(term)));
  const group = timed(script.words);
  return <div>
    <div className="template-filters">
      <RadioChips label="Template category" items={chips} value={active} onChange={choose} />
      <input ref={search} type="search" className="input template-search" aria-label="Search templates" placeholder="Search templates" value={query} onChange={e => setQuery(e.target.value)} />
      <RadioChips label="Preview text" items={scripts} value={script.id} onChange={id => setScript(scripts.find(x => x.id === id)!)} />
      <p role="status" className="template-status">{visible.length === 1 ? '1 template' : visible.length + ' templates'}</p>
    </div>
    <div className="template-gallery-heading"><p>Choose a look</p><button type="button" aria-pressed={playing} disabled={reducedMotion} title={reducedMotion ? 'Motion previews are disabled by your reduced-motion preference.' : undefined} onClick={() => { setPlaying(!playing); setTime(.6); }}>
      {playing ? <Pause size={16} strokeWidth={1.5} aria-hidden="true" /> : <Play size={16} strokeWidth={1.5} aria-hidden="true" />}
      {playing ? 'Pause template previews' : 'Play template previews'}
    </button></div>
    {visible.length === 0 && <div className="template-empty"><p>No templates match.</p><button type="button" className="btn-text" onClick={() => { setQuery(''); choose('all'); search.current?.focus(); }}>Clear filters</button></div>}
    <div className="template-grid">{visible.map(template => <button type="button" key={template.id} className={'template-tile ' + (selected === template.id ? 'is-selected' : '')} aria-pressed={selected === template.id} onClick={() => (active === 'mine' && onSelectCustom ? onSelectCustom : onSelect)(template)} onPointerEnter={() => setHot(template.id)} onPointerLeave={() => setHot(undefined)} onFocus={() => setHot(template.id)} onBlur={() => setHot(undefined)}>
      <TemplatePreview template={template} group={group} time={template.style.animation === 'typewriter' && !playing ? 2.8 : time} still={template.style.animation === 'typewriter' ? 2.8 : .6} reveal={hot === template.id && !playing && !reducedMotion} />
      <span className="template-name">{template.name}</span><span className="template-description">{template.description}</span>
      {selected === template.id && <span className="template-selected" aria-hidden="true"><Check size={12} strokeWidth={2} /></span>}
    </button>)}</div>
  </div>;
}

// Hover or focus reveal: words rise into place one by one; karaoke looks also get a focus frame stepping across the words.
function TemplatePreview({ template, group, time, still, reveal }: { template: CaptionTemplate; group: ReturnType<typeof timed>; time: number; still: number; reveal: boolean }) {
  const frame = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState(0);
  const [near, setNear] = useState(true);
  const [boxes, setBoxes] = useState<Box[]>([]);
  useEffect(() => {
    const node = frame.current;
    if (!node) return;
    const observer = new ResizeObserver(() => setWidth(node.clientWidth));
    observer.observe(node);
    // Off-screen tiles show the static frame so 40 previews do not all animate.
    const seen = new IntersectionObserver(([entry]) => setNear(!!entry?.isIntersecting), { rootMargin: '100px' });
    seen.observe(node);
    return () => { observer.disconnect(); seen.disconnect(); };
  }, []);
  const karaoke = template.style.animation === 'karaoke';
  useEffect(() => {
    const art = frame.current, root = art?.querySelector<HTMLElement>('[data-caption-overlay]');
    if (!reveal || !art || !root) return;
    const origin = art.getBoundingClientRect();
    if (karaoke) setBoxes(Array.from(root.querySelectorAll('[data-active]'), el => { const r = el.getBoundingClientRect(); return { x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height }; }));
    // shortcut: borrows CaptionOverlay's unstyled per-word wrappers as the moving layer and clears every inline style after; upgrade to a reveal prop if the overlay grows one.
    const words = Array.from(root.children) as HTMLElement[];
    const reset = () => { root.style.overflow = ''; for (const w of words) { w.style.display = w.style.whiteSpace = w.style.transform = w.style.opacity = ''; } };
    root.style.overflow = 'hidden';
    for (const w of words) { w.style.display = 'inline-block'; w.style.whiteSpace = 'pre'; w.style.transform = 'translateY(100%)'; w.style.opacity = '0'; }
    const controls = animate(words, { y: ['100%', '0%'], opacity: [0, 1] }, { duration: .3, ease, delay: stagger(.05) });
    void controls.then(reset);
    return () => { controls.stop(); reset(); setBoxes([]); };
  }, [reveal, karaoke]);
  return <span ref={frame} className="template-art" aria-hidden="true">
    {width > 0 && <CaptionOverlay group={group} style={{ ...template.style, fontSize: 36, stroke: { ...template.style.stroke, width: template.style.stroke.width * 36 / template.style.fontSize }, positionX: .5, positionY: .5 }} time={near ? time : still} width={320} height={180} scale={width / 320} />}
    {boxes.length > 1 && <FocusFrame boxes={boxes} />}
  </span>;
}

type Box = { x: number; y: number; w: number; h: number };
const corners = [[0, 0], [1, 0], [0, 1], [1, 1]] as const;
// Four mint corners hold on each word, then glide to the next (True Focus, no blur). Transform and opacity only.
function FocusFrame({ boxes }: { boxes: Box[] }) {
  const n = boxes.length, loop = [...boxes, boxes[0]!];
  const times = [...boxes.flatMap((_, i) => [i / n, (i + .7) / n]), 1];
  const path = (pick: (b: Box) => number) => [...boxes.flatMap(b => [pick(b), pick(b)]), pick(loop[n]!)];
  return <>{corners.map(([cx, cy]) => {
    const x = path(b => b.x - 4 + cx * b.w), y = path(b => b.y - 4 + cy * b.h);
    return <motion.span key={cx + '' + cy} className={'absolute left-0 top-0 h-2 w-2 border-primary ' + (cx ? 'border-r-2 ' : 'border-l-2 ') + (cy ? 'border-b-2' : 'border-t-2')}
      initial={{ opacity: 0, x: x[0], y: y[0] }} animate={{ opacity: 1, x, y }}
      transition={{ opacity: { delay: .3, duration: .2 }, default: { delay: .4, duration: n * .6, times, ease, repeat: Infinity } }} />;
  })}</>;
}

function RadioChips({ label, items, value, onChange }: { label: string; items: { id: string; label: string }[]; value: string; onChange: (id: string) => void }) {
  const group = useRef<HTMLDivElement>(null);
  function onKey(e: React.KeyboardEvent, i: number) {
    const next = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: items.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault(); const j = (next + items.length) % items.length;
    onChange(items[j]!.id); (group.current?.children[j] as HTMLElement).focus();
  }
  return <div ref={group} role="radiogroup" aria-label={label} className="template-chips">{items.map((c, i) => <button type="button" role="radio" key={c.id} aria-checked={value === c.id} tabIndex={value === c.id ? 0 : -1} className="template-chip" onClick={() => onChange(c.id)} onKeyDown={e => onKey(e, i)}>{c.label}</button>)}</div>;
}
