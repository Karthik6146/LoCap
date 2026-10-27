'use client';
import { useEffect, useRef, useState } from 'react';
import { CAPTION_TEMPLATES, TEMPLATE_CATEGORIES, type CaptionTemplate } from '@clipx/captions';
import { CaptionOverlay } from './caption-overlay';

const scripts = [
  { id: 'hinglish', label: 'Hinglish', words: ['Aaj', 'kuch', 'naya'] },
  { id: 'hindi', label: 'Hindi', words: ['आज', 'कुछ', 'नया'] },
  { id: 'english', label: 'English', words: ['Something', 'new', 'today'] },
];
const categoryKey = 'clipx-template-category';
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
    <div className="template-gallery-heading"><p>Choose a look. Make it yours.</p><button type="button" aria-pressed={playing} disabled={reducedMotion} title={reducedMotion ? 'Motion previews are disabled by your reduced-motion preference.' : undefined} onClick={() => { setPlaying(!playing); setTime(.6); }}>
      <svg aria-hidden="true" width="13" height="13" viewBox="0 0 16 16" fill="currentColor">{playing ? <path d="M4 3h3v10H4zM9 3h3v10H9z" /> : <path d="m5 2 9 6-9 6Z" />}</svg>
      {playing ? 'Pause template previews' : 'Play template previews'}
    </button></div>
    {visible.length === 0 && <div className="template-empty"><p>No templates match.</p><button type="button" className="btn btn-ghost" onClick={() => { setQuery(''); choose('all'); search.current?.focus(); }}>Clear filters</button></div>}
    <div className="template-grid">{visible.map(template => <button type="button" key={template.id} className={'template-tile ' + (selected === template.id ? 'is-selected' : '')} aria-pressed={selected === template.id} onClick={() => (active === 'mine' && onSelectCustom ? onSelectCustom : onSelect)(template)}>
      <TemplatePreview template={template} group={group} time={template.style.animation === 'typewriter' && !playing ? 2.8 : time} still={template.style.animation === 'typewriter' ? 2.8 : .6} />
      <span className="template-name">{template.name}</span><span className="template-description">{template.description}</span>
      {selected === template.id && <span className="template-selected" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 8 3 3 7-7" /></svg></span>}
    </button>)}</div>
  </div>;
}

function TemplatePreview({ template, group, time, still }: { template: CaptionTemplate; group: ReturnType<typeof timed>; time: number; still: number }) {
  const frame = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState(0);
  const [near, setNear] = useState(true);
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
  return <span ref={frame} className="template-art" aria-hidden="true">
    {width > 0 && <CaptionOverlay group={group} style={{ ...template.style, fontSize: 36, stroke: { ...template.style.stroke, width: template.style.stroke.width * 36 / template.style.fontSize }, positionX: .5, positionY: .5 }} time={near ? time : still} width={320} height={180} scale={width / 320} />}
  </span>;
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
