'use client';

import { useEffect, useRef, useState, type PointerEvent, type KeyboardEvent } from 'react';
import { romanizeHindi } from '@clipx/ai/hinglish';
import { CaptionOverlay } from '@/components/caption-overlay';
import { CustomCaptionTemplates } from '@/components/custom-caption-templates';
import type { Caption, CaptionStyle } from '@clipx/types';
import { ANIMATIONS, CAPTION_FONTS, repageCaptions, HistoryStack, replaceLine, retimeCaption, validateDocument, type CaptionDocument } from '@clipx/captions';

type Props = { videoId: string; sourceKey: string; audioKey?: string; duration: number; width: number; height: number; initial: CaptionDocument; initialRevision: string; sourceWords?: {text: string; start: number; end: number}[] };
export default function CaptionEditor(p: Props) {
  const [doc, setDoc] = useState(p.initial);
  const [revision, setRevision] = useState(p.initialRevision);
  const [saved, setSaved] = useState(JSON.stringify(p.initial));
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [time, setTime] = useState(0);
  const [selected, setSelected] = useState<string>();
  const [shift, setShift] = useState(0);
  const [showStyle, setShowStyle] = useState(false);
  const [appearanceTab, setAppearanceTab] = useState<'templates' | 'customize'>('templates');
  const [guides, setGuides] = useState(true);
  const [query, setQuery] = useState('');
  const [previewWidth, setPreviewWidth] = useState(640);
  const [jobId, setJobId] = useState('');
  const [download, setDownload] = useState('');
  const [progress, setProgress] = useState(0);
  const history = useRef(new HistoryStack<CaptionDocument>());
  const video = useRef<HTMLVideoElement>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const [useExtractedAudio, setUseExtractedAudio] = useState(false);
  const [soundOff, setSoundOff] = useState(false);
  const [audioError, setAudioError] = useState('');
  useEffect(() => {
    const v = video.current, a = audio.current;
    if (!v || !a || !useExtractedAudio) return;
    const sync = () => { if (Math.abs(a.currentTime - v.currentTime) > .15) a.currentTime = v.currentTime; a.playbackRate = v.playbackRate; };
    const play = () => { sync(); void a.play().catch(() => setAudioError('Audio playback was blocked. Pause, then press Play again.')); };
    const pause = () => a.pause();
    v.addEventListener('playing', play); v.addEventListener('waiting', pause); v.addEventListener('pause', pause); v.addEventListener('seeking', sync); v.addEventListener('ratechange', sync); v.addEventListener('timeupdate', sync); v.addEventListener('ended', pause);
    sync();
    return () => { a.pause(); v.removeEventListener('playing', play); v.removeEventListener('waiting', pause); v.removeEventListener('pause', pause); v.removeEventListener('seeking', sync); v.removeEventListener('ratechange', sync); v.removeEventListener('timeupdate', sync); v.removeEventListener('ended', pause); };
  }, [useExtractedAudio]);
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointerId: number; before: CaptionDocument; startX: number; startY: number; offsetX: number; offsetY: number; moved: boolean } | null>(null);
  const dirty = JSON.stringify(doc) !== saved;
  const active = doc.captions.find(c => time >= c.start && time < c.end);
  const scale = previewWidth / p.width;
  const style = doc.style;

  useEffect(() => {
    const node = frame.current;
    if (!node) return;
    const observer = new ResizeObserver(() => setPreviewWidth(node.clientWidth));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  useEffect(() => {
    let id: number;
    const tick = () => { if (video.current) setTime(video.current.currentTime); id = requestAnimationFrame(tick); };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);
  useEffect(() => {
    if (!jobId) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const res = await fetch('/api/jobs/' + jobId, { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not check export');
        if (disposed) return;
        setProgress(data.progress); setMessage(data.message);
        if (data.status === 'failed') { setError(data.error); setJobId(''); return; }
        if (data.status === 'completed') {
          if (!data.outputKey) throw new Error('Export finished without a file. Please retry.');
          setDownload('/api/files?download=1&key=' + encodeURIComponent(data.outputKey)); setJobId(''); return;
        }
        timer = setTimeout(poll, 2000);
      } catch (e) { if (!disposed) { setError((e as Error).message); timer = setTimeout(poll, 5000); } }
    }
    void poll();
    return () => { disposed = true; clearTimeout(timer); };
  }, [jobId]);

  function change(next: CaptionDocument) {
    history.current.record(doc); setDoc(next); setError(''); setDownload('');
  }
  function update(c: Caption) { change({ ...doc, captions: doc.captions.map(x => x.id === c.id ? c : x) }); }
  function styleChange(patch: Partial<CaptionStyle>) { change({ ...doc, captions: patch.maxWordsPerGroup !== undefined ? repageCaptions(doc.captions, patch.maxWordsPerGroup) : doc.captions, style: { ...style, ...patch } }); }
  function customPosition(x: number, y: number, overlay: HTMLElement, bounds: DOMRect): Partial<CaptionStyle> {
    const rect = overlay.getBoundingClientRect();
    const marginX = Math.min(.5, Math.max(.08, rect.width / bounds.width / 2 + .01));
    const marginY = Math.min(.5, Math.max(.08, rect.height / bounds.height / 2 + .01));
    return { positionX: Math.max(marginX, Math.min(1 - marginX, x)), positionY: Math.max(marginY, Math.min(1 - marginY, y)), alignment: 'center' };
  }
  function startDrag(e: PointerEvent<HTMLDivElement>) {
    const overlay = (e.target as Element).closest<HTMLElement>('[data-caption-overlay]');
    if (!overlay || busy || drag.current || !e.isPrimary || e.button !== 0) return;
    e.preventDefault(); overlay.focus({ preventScroll: true }); video.current?.pause();
    const rect = overlay.getBoundingClientRect();
    drag.current = { pointerId: e.pointerId, before: doc, startX: e.clientX, startY: e.clientY, offsetX: rect.left + rect.width / 2 - e.clientX, offsetY: rect.top + rect.height / 2 - e.clientY, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId); setDragging(true);
  }
  function moveDrag(e: PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (!current || current.pointerId !== e.pointerId || (!current.moved && Math.hypot(e.clientX - current.startX, e.clientY - current.startY) < 2)) return;
    const overlay = e.currentTarget.querySelector<HTMLElement>('[data-caption-overlay]');
    if (!overlay) return;
    const bounds = e.currentTarget.getBoundingClientRect();
    const patch = customPosition((e.clientX + current.offsetX - bounds.left) / bounds.width, (e.clientY + current.offsetY - bounds.top) / bounds.height, overlay, bounds);
    current.moved = true; setDoc({ ...current.before, style: { ...current.before.style, ...patch } }); setError(''); setDownload('');
  }
  function finishDrag(e: PointerEvent<HTMLDivElement>, cancel = false) {
    const current = drag.current;
    if (!current || current.pointerId !== e.pointerId) return;
    drag.current = null;
    if (cancel) setDoc(current.before);
    else if (current.moved) history.current.record(current.before);
    setDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  }
  function nudgeCaption(e: KeyboardEvent<HTMLDivElement>) {
    const overlay = (e.target as Element).closest<HTMLElement>('[data-caption-overlay]');
    if (!overlay || busy || dragging || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault(); video.current?.pause();
    const rect = overlay.getBoundingClientRect(), bounds = e.currentTarget.getBoundingClientRect();
    const step = e.shiftKey ? .05 : .01;
    styleChange(customPosition((rect.left + rect.width / 2 - bounds.left) / bounds.width + (e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0), (rect.top + rect.height / 2 - bounds.top) / bounds.height + (e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0), overlay, bounds));
  }
  function seek(c: Caption) { setSelected(c.id); if (video.current) video.current.currentTime = c.start; setTime(c.start); }
  async function save() {
    setBusy(true); setError('');
    try {
      const normalized = { ...doc, captions: doc.captions.map(c => ({ ...c, text: c.words.map(w => w.text.trim()).join(' ') })) };
      validateDocument(normalized, p.duration);
      const res = await fetch('/api/captions/' + p.videoId + '/edit', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ document: normalized, revision }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRevision(data.revision); setDoc(normalized); setSaved(JSON.stringify(normalized)); setMessage('All changes saved');
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function render() {
    setBusy(true); setError(''); setDownload('');
    try {
      const res = await fetch('/api/captions/' + p.videoId + '/render', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revision }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setJobId(data.jobId); setProgress(0);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  function add() {
    const start = Math.max(time, doc.captions.at(-1)?.end ?? 0);
    const end = Math.min(p.duration, start + 2);
    if (end <= start) { setError('No space at the end. Delete or shorten a segment first.'); return; }
    const c: Caption = { id: crypto.randomUUID(), clipId: '', script: 'mixed', text: '', start, end, words: [], grouping: 'custom', order: doc.captions.length, styleId: 'editor' };
    change({ ...doc, captions: [...doc.captions, replaceLine(c, 'New caption')] });
  }
  function split(c: Caption, index: number) {
    const left = c.words.slice(0, index), right = c.words.slice(index);
    if (!left.length || !right.length) return;
    const a = { ...c, end: left.at(-1)!.end, words: left, text: left.map(w => w.text).join(' ') };
    const b = { ...c, id: crypto.randomUUID(), start: right[0]!.start, words: right, text: right.map(w => w.text).join(' ') };
    change({ ...doc, captions: doc.captions.flatMap(x => x.id === c.id ? [a, b] : [x]) });
  }

  return <div className="space-y-4">
    <div className="studio-toolbar card p-3 flex flex-wrap items-center gap-2">
      <button className="btn btn-ghost" title={history.current.canUndo ? undefined : 'Nothing to undo yet'} disabled={busy || dragging || !history.current.canUndo} onClick={() => { const prev = history.current.undo(doc); if (prev) setDoc(prev); }}>Undo</button>
      <button className="btn btn-ghost" title={history.current.canRedo ? undefined : 'Nothing to redo'} disabled={busy || dragging || !history.current.canRedo} onClick={() => { const next = history.current.redo(doc); if (next) setDoc(next); }}>Redo</button>
      <button className="btn btn-primary" title={dirty ? undefined : 'No changes to save'} disabled={busy || dragging || !dirty} onClick={save}>{busy ? 'Working…' : 'Save changes'}</button>
      <span role="status" className={'studio-save-state' + (dirty ? ' is-dirty' : '')}><span aria-hidden="true" />{dirty ? 'Unsaved changes' : 'Saved'}{message ? ' · ' + message : ''}</span>
    </div>
    {error && <p role="alert" className="rounded-xl border border-red-500 p-3 text-red-200">{error}</p>}
    <div className="studio-workspace">
      <section className="studio-canvas min-w-0 space-y-4" aria-label="Caption preview and styling"><div className="flex justify-between items-center"><h2 className="text-sm font-semibold">Preview</h2><span className="text-xs text-gray-400">{Math.round(p.width)} &times; {Math.round(p.height)}</span></div>
        <div ref={frame} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={e => finishDrag(e)} onPointerCancel={e => finishDrag(e, true)} onLostPointerCapture={e => finishDrag(e, true)} onKeyDown={nudgeCaption} className="studio-preview relative bg-black overflow-hidden rounded-2xl" style={{ aspectRatio: p.width + '/' + p.height, width: `min(100%, ${560 * p.width / p.height}px)` }}>
          <video ref={video} className="w-full h-full" src={'/api/files?key=' + encodeURIComponent(p.sourceKey)} controls playsInline preload="metadata" muted={useExtractedAudio || soundOff} onVolumeChange={e => { if (!useExtractedAudio) setSoundOff(e.currentTarget.muted || e.currentTarget.volume === 0); }} onError={() => setAudioError('This browser cannot play the source video. Try an MP4 with H.264 video and AAC audio.')} aria-label="Source video with caption preview" />
          {guides && <div aria-hidden="true" className="absolute pointer-events-none border border-dashed border-white/30" style={{ inset: '8% 8% 15%' }} />}
          {active && <CaptionOverlay group={active} style={style} time={time} width={p.width} height={p.height} scale={scale} interactive={!busy} />}
        </div>
        <div id="caption-position" className="text-sm scroll-mt-32">
          <p className="font-semibold">Custom position</p>
          <p className="text-gray-400">Pause on a caption, then drag it in the preview. Use arrow keys for fine adjustments. Applies to all captions; save changes and export MP4.</p>
        </div>
        <label className="flex gap-2 items-center"><input type="checkbox" checked={guides} onChange={e => setGuides(e.target.checked)} />Safe placement guide (approximate)</label>
        <p className="text-sm text-gray-400">Video: {p.width} × {p.height}. Bundled fonts: Montserrat, Anton, Poppins, Baloo 2, Rozha One, Teko, Playfair Display and Noto Sans Devanagari. Legacy system fonts may vary. Keep each line inside the guide.</p>
        <label className="block text-xs text-gray-400">Playhead &middot; {time.toFixed(2)}s<input className="w-full mt-2 accent-primary" aria-label="Preview playhead" type="range" min="0" max={p.duration} step="0.01" value={time} onChange={e => { const value = +e.target.value; setTime(value); if (video.current) video.current.currentTime = value; }} /></label>
      <div className="studio-audio card p-3 space-y-2" aria-label="Preview sound">
        {p.audioKey && <audio ref={audio} src={'/api/files?key=' + encodeURIComponent(p.audioKey)} preload="metadata" muted={soundOff} onError={() => setAudioError('Extracted audio could not load. Reload the page or regenerate captions.')} />}
        <button className="btn btn-ghost" onClick={() => { const off = !soundOff; setSoundOff(off); if (video.current) { video.current.volume = 1; video.current.muted = useExtractedAudio || off; } if (audio.current) { audio.current.volume = 1; audio.current.muted = off; } }}>{soundOff ? 'Turn sound on' : 'Mute sound'}</button>
        {p.audioKey && <label className="block text-xs text-gray-300"><input type="checkbox" checked={useExtractedAudio} onChange={e => { video.current?.pause(); setUseExtractedAudio(e.target.checked); setSoundOff(false); setAudioError(''); }} /> Use extracted audio if the original is silent</label>}
        {audioError && <p role="alert" className="text-xs text-red-300">{audioError}</p>}
      </div></section>
      <section className="studio-style-panel" aria-label="Caption appearance">
        <button className="btn btn-ghost xl:hidden" aria-expanded={showStyle} onClick={() => setShowStyle(!showStyle)}>{showStyle ? "Hide style controls" : "Style captions"}</button>
        <fieldset disabled={busy} className={"card p-4 space-y-4 " + (showStyle ? "" : "hidden xl:block")}>
          <legend className="font-semibold px-2">Make it yours</legend>
          <div className="studio-panel-tabs" role="group" aria-label="Appearance controls"><button type="button" aria-pressed={appearanceTab === 'templates'} onClick={() => setAppearanceTab('templates')}>Templates</button><button type="button" aria-pressed={appearanceTab === 'customize'} onClick={() => setAppearanceTab('customize')}>Customize</button></div>
          <div hidden={appearanceTab !== 'templates'}>
          <CustomCaptionTemplates style={style} height={p.height} onApply={next => styleChange(next)} /></div>
          <div hidden={appearanceTab !== 'customize'} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label>Font<select aria-label="Font" className="input" value={style.font} onChange={e => styleChange({ font: e.target.value })}>{CAPTION_FONTS.map(f => <option key={f}>{f}</option>)}</select></label>
            <label>Size (source pixels)<input className="input" type="number" min="16" max="160" value={style.fontSize} onChange={e => styleChange({ fontSize: +e.target.value })} /></label>
            <label>Text color<input aria-label="Text color" className="input h-11" type="color" value={style.color} onChange={e => styleChange({ color: e.target.value })} /></label>
          </div>
          <label className="flex gap-2"><input type="checkbox" checked={style.highlight.enabled} onChange={e => styleChange({ highlight: { ...style.highlight, enabled: e.target.checked } })} />Highlight the speaking word</label>
          <details><summary className="cursor-pointer py-2">Advanced styling</summary><div className="grid grid-cols-2 gap-3 pt-3">
            <label>Weight<select className="input" value={style.fontWeight} onChange={e => styleChange({ fontWeight: +e.target.value })}><option value="400">Regular</option><option value="700">Bold</option></select></label>
            <label>Opacity<input className="input" type="number" min="0" max="1" step="0.1" value={style.opacity ?? 1} onChange={e => styleChange({ opacity: +e.target.value })} /></label>
            <label>Highlight color<input className="input h-11" type="color" value={style.highlightColor} onChange={e => styleChange({ highlightColor: e.target.value })} /></label>
            <label>Stroke width<input disabled={style.background.enabled} className="input" type="number" min="0" max="10" value={style.stroke.width} onChange={e => styleChange({ stroke: { ...style.stroke, width: +e.target.value } })} /></label>
            <label>Stroke color<input className="input h-11" type="color" value={style.stroke.color} onChange={e => styleChange({ stroke: { ...style.stroke, color: e.target.value } })} /></label>
            <label>Shadow offset<input className="input" type="number" min="0" max="10" value={style.shadow.offsetY} onChange={e => styleChange({ shadow: { ...style.shadow, offsetY: +e.target.value } })} /></label>
            <label>Shadow color<input className="input h-11" type="color" value={style.shadow.color} onChange={e => styleChange({ shadow: { ...style.shadow, color: e.target.value } })} /></label>
            <label>Background color<input className="input h-11" type="color" value={style.background.color} onChange={e => styleChange({ background: { ...style.background, color: e.target.value } })} /></label>
            <label>Background opacity<input className="input" type="number" min="0" max="1" step="0.1" value={style.background.opacity} onChange={e => styleChange({ background: { ...style.background, opacity: +e.target.value } })} /></label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={style.background.enabled} onChange={e => styleChange({ background: { ...style.background, enabled: e.target.checked } })} />Box background (replaces stroke)</label>
            <label>Animation<select className="input" value={style.animation} onChange={e => styleChange({ animation: e.target.value as CaptionStyle['animation'] })}>{ANIMATIONS.map(a => <option key={a}>{a}</option>)}</select></label>
          </div></details>
          <label className="block">Words per caption<input aria-label="Words per caption" className="input" type="number" min="1" max="12" value={style.maxWordsPerGroup} onChange={e => { const n = +e.target.value; if (Number.isInteger(n) && n >= 1 && n <= 12) styleChange({ maxWordsPerGroup: n }); }} /></label>
          <label className="block">Animation strength<input aria-label="Animation strength" className="w-full" type="range" min="0" max="1" step="0.05" value={style.animationStrength ?? 1} onChange={e => styleChange({ animationStrength: +e.target.value })} /></label>
          <p className="text-xs text-gray-400">Style changes keep your words and timing. Undo restores previous caption grouping.</p>
          </div>
        </fieldset>
      </section>
      <section className="studio-caption-panel min-w-0 space-y-3" aria-label="Caption timeline"><div className="flex justify-between items-center"><h2 className="text-sm font-semibold">Your captions</h2><span className="text-xs text-gray-400">{doc.captions.length} segments</span></div>
        <div className="flex flex-wrap gap-2 items-end"><button className="btn btn-ghost" disabled={busy} onClick={add}>Add segment</button><label>Global shift (seconds)<input className="input w-28" type="number" step="0.1" value={shift} onChange={e => setShift(+e.target.value)} /></label><button className="btn btn-ghost" disabled={busy} onClick={() => change({ ...doc, captions: doc.captions.map(c => retimeCaption(c, c.start + shift, c.end + shift)) })}>Apply shift</button></div>
        <p className="text-sm text-gray-400">Edit a line or individual words. Changing the word count redistributes timing within that segment. Change the output language from your project before regenerating. Review names and Roman spellings here.</p>
        <input type="search" className="input" aria-label="Search captions" placeholder="Find a word or phrase?" value={query} onChange={e => setQuery(e.target.value)} />
        {!!query && !doc.captions.some(c => c.text.toLocaleLowerCase().includes(query.toLocaleLowerCase())) && <p role="status" className="text-sm text-gray-400">No matching captions.</p>}
        {!doc.captions.length && <p className="card p-5">No captions yet. Wait for processing, retry from the project page, or add a segment.</p>}
        <fieldset disabled={busy} className="space-y-3 max-h-[75vh] overflow-y-auto pr-1">
          <legend className="sr-only">Edit caption segments</legend>
          {doc.captions.map((c, i) => { const open = c.id === selected || (i === 0 && !doc.captions.some(x => x.id === selected)); return <article hidden={!!query && !c.text.toLocaleLowerCase().includes(query.toLocaleLowerCase())} key={c.id} className={'studio-segment card p-4 space-y-3 ' + (selected === c.id || active?.id === c.id ? 'border-primary' : '')}>
            <div className="flex flex-wrap gap-2 items-center"><button className="btn btn-ghost" aria-label={'Seek to segment ' + (i+1)} onClick={() => seek(c)}>▶ {i + 1}</button>{open ? <><label className="text-sm">Start<input aria-label={'Segment ' + (i+1) + ' start'} className="input w-24" type="number" step="0.01" value={Number(c.start.toFixed(3))} onChange={e => update(retimeCaption(c, +e.target.value, c.end))} /></label><label className="text-sm">End<input aria-label={'Segment ' + (i+1) + ' end'} className="input w-24" type="number" step="0.01" value={Number(c.end.toFixed(3))} onChange={e => update(retimeCaption(c, c.start, +e.target.value))} /></label></> : <span className="studio-segment-time">{c.start.toFixed(2)}s – {c.end.toFixed(2)}s</span>}</div>
            <input className="input w-full" aria-label={'Caption line ' + (i + 1)} value={c.text} onFocus={() => setSelected(c.id)} onChange={e => update(replaceLine(c, e.target.value))} />
            {/* Only the selected segment renders its detailed controls, keeping long transcripts keyboard-navigable. */}
            {open && <>
            {/[\u0900-\u097f]/.test(c.text) && <button className="btn btn-ghost" onClick={() => update({ ...c, text: romanizeHindi(c.text), words: c.words.map(w => ({ ...w, text: romanizeHindi(w.text) })) })}>Convert Hindi to Hinglish</button>}
            {p.sourceWords?.some(w => (w.start + w.end) / 2 >= c.start && (w.start + w.end) / 2 < c.end) && <details className="studio-source"><summary>Original speech text</summary><p lang="hi" className="py-2 text-sm text-gray-300">{p.sourceWords.filter(w => (w.start + w.end) / 2 >= c.start && (w.start + w.end) / 2 < c.end).map(w => w.text).join(' ')}</p><p className="text-xs text-gray-400">Check against the audio. Paste corrected Hindi into the caption above, then convert to Hinglish.</p></details>}
            <details><summary className="cursor-pointer py-2 text-sm">Words & split points</summary><div className="space-y-2">{c.words.map((w, j) => <div key={w.id} className="flex flex-wrap gap-2 items-center"><input className="input min-w-0 flex-1" aria-label={'Word ' + (j+1)} value={w.text} onChange={e => { const words = c.words.map(x => x.id === w.id ? { ...x, text: e.target.value } : x); update({ ...c, words, text: words.map(x => x.text).join(' ') }); }} /><label className="text-xs text-gray-400">Start<input aria-label={'Word ' + (j+1) + ' start in segment ' + (i+1)} className="input w-20" type="number" step="0.01" value={Number(w.start.toFixed(3))} onChange={e => update({ ...c, words: c.words.map(x => x.id === w.id ? { ...x, start: +e.target.value } : x) })} /></label><label className="text-xs text-gray-400">End<input aria-label={'Word ' + (j+1) + ' end in segment ' + (i+1)} className="input w-20" type="number" step="0.01" value={Number(w.end.toFixed(3))} onChange={e => update({ ...c, words: c.words.map(x => x.id === w.id ? { ...x, end: +e.target.value } : x) })} /></label>{j > 0 && <button className="btn btn-ghost" onClick={() => split(c, j)}>Split before</button>}</div>)}</div></details>
            <div className="flex gap-2"><button className="btn btn-ghost" disabled={!doc.captions[i+1]} onClick={() => { const next = doc.captions[i+1]!; change({ ...doc, captions: doc.captions.filter(x => x.id !== next.id).map(x => x.id === c.id ? { ...c, end: next.end, words: [...c.words, ...next.words], text: c.text + ' ' + next.text } : x) }); }}>Merge next</button><button className="btn btn-ghost" onClick={() => change({ ...doc, captions: doc.captions.filter(x => x.id !== c.id) })}>Delete</button></div>
            </>}
          </article>; })}
        </fieldset>
      </section>
    </div>
    <section className="studio-export card p-4 space-y-3" aria-label="Export captions">
      <h2 className="font-semibold">Export your saved captions</h2>
      <p className="text-sm text-gray-400">MP4 keeps the source aspect ratio and resolution. SRT/VTT include text and timing; styling is burned into MP4 only.</p>
      <div className="flex flex-wrap gap-3"><button className="btn btn-primary" disabled={dirty || busy || !!jobId || !doc.captions.length} onClick={render}>Export captioned MP4</button>{!dirty && doc.captions.length > 0 && ['srt', 'vtt'].map(format => <a key={format} className="btn btn-ghost" href={'/api/captions/' + p.videoId + '?format=' + format}>Download {format.toUpperCase()}</a>)}{download && <a className="btn btn-primary" href={download}>Download rendered MP4</a>}</div>
      {dirty && <p className="text-sm">Save your changes to enable downloads and export.</p>}
      {jobId && <div role="status"><progress className="w-full" value={progress} max="100" aria-label="Video export progress" />{message}</div>}
    </section>
  </div>;
}
