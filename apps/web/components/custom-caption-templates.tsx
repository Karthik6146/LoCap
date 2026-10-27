'use client';
import { useEffect, useState } from 'react';
import type { CaptionStyle } from '@clipx/types';
import { CAPTION_TEMPLATES, EDITOR_STYLE, parseCustomTemplate, templateStyle, type CaptionTemplate } from '@clipx/captions';
import { TemplateGallery } from './caption-templates';

const key = 'clipx-caption-templates-v1';
export function CustomCaptionTemplates({ style, height, onApply }: { style: CaptionStyle; height: number; onApply: (style: CaptionStyle) => void }) {
  const [custom, setCustom] = useState<CaptionTemplate[]>([]);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState(style.id);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    try { const items: unknown = JSON.parse(localStorage.getItem(key) ?? '[]'); if (!Array.isArray(items) || items.length > 30) throw new Error(); setCustom(items.map(parseCustomTemplate)); }
    catch { setNotice('Saved templates could not be loaded. You can import or save a new style.'); }
  }, []);
  function persist(items: CaptionTemplate[]) {
    if (items.length > 30) throw new Error('Keep up to 30 custom templates. Remove one before adding another.');
    localStorage.setItem(key, JSON.stringify(items)); setCustom(items);
  }
  function save() {
    try {
      const t = parseCustomTemplate({ name, style: { ...style, fontSize: Math.min(160, Math.max(16, style.fontSize * 1080 / height)), yOffset: Math.min(2000, style.yOffset * 1080 / height) } });
      persist([...custom, t]); setName(''); setNotice('Template saved in this browser.');
    } catch (e) { setNotice((e as Error).message); }
  }
  async function upload(file?: File) {
    if (!file) return;
    try { if (file.size > 32_000) throw new Error('Template files must be smaller than 32 KB.'); const t = parseCustomTemplate(JSON.parse(await file.text())); persist([...custom, t]); setNotice('Template imported. Select it to apply.'); }
    catch (e) { setNotice('Import failed: ' + (e as Error).message); }
  }
  function download(t: CaptionTemplate) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(t, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'caption-template.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const legacy = !!style.id && ![...CAPTION_TEMPLATES, ...custom].some(t => t.id === style.id) && style.id !== EDITOR_STYLE.id;
  return <div className="space-y-4">
    {legacy && <p role="status" className="text-sm text-gray-400">Current style: Custom (legacy)</p>}
    <TemplateGallery selected={selected} custom={custom} onSelect={t => { setSelected(t.id); onApply(templateStyle(t.id, height)); }} onSelectCustom={t => { setSelected(t.id); onApply({ ...structuredClone(t.style), fontSize: Math.min(160, Math.max(16, t.style.fontSize * height / 1080)), yOffset: Math.min(2000, t.style.yOffset * height / 1080) }); }} />
    {custom.length > 0 && <>
      {custom.map(t => <div key={t.id} className="flex gap-2 items-center text-xs"><span className="flex-1 truncate">{t.name}</span><button className="btn btn-ghost" onClick={() => download(t)} aria-label={'Export template ' + t.name}>Export JSON</button><button className="btn btn-ghost" aria-label={'Remove template ' + t.name} onClick={() => { try { persist(custom.filter(x => x.id !== t.id)); } catch { setNotice('Could not remove template. Browser storage is unavailable.'); } }}>Remove</button></div>)}</>}
    <div className="border-t border-border pt-4"><label className="label" htmlFor="template-name">Save your current style as a template</label><div className="flex gap-2"><input id="template-name" className="input min-w-0" maxLength={40} placeholder="My signature style" value={name} onChange={e => setName(e.target.value)} /><button className="btn btn-ghost shrink-0" disabled={!name.trim()} onClick={save}>Save template</button></div>
      <label className="block text-xs text-gray-400 mt-3">Import a template (.json)<input className="block mt-2 w-full text-xs" type="file" accept=".json,application/json" onChange={e => { void upload(e.target.files?.[0]); e.target.value = ''; }} /></label>
      <p className="text-xs text-gray-400 mt-2">Saved in this browser. Export JSON to use on another device.</p>
    </div>
    {notice && <p role="status" className="text-sm text-gray-300">{notice}</p>}
  </div>;
}
