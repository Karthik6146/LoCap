'use client';
import type { GenerationOptions } from '@clipx/types';
import { CAPTION_TEMPLATES } from '@clipx/captions';
import { TemplateGallery } from './caption-templates';

export function GenerationSettings({ value, onChange }: { value: GenerationOptions; onChange: (value: GenerationOptions) => void }) {
  const templateName = CAPTION_TEMPLATES.find(template => template.id === value.templateId)?.name ?? 'Choose a style';
  return <div className="space-y-6">
    <fieldset><legend className="text-sm font-semibold mb-3">What would you like to create?</legend><div className="grid grid-cols-2 gap-3">
      {([{ id: 'video', name: 'Captioned video', detail: 'Styled captions + SRT download' }, { id: 'srt', name: 'SRT only', detail: 'Subtitle file. Skip video rendering.' }] as const).map(option => <label key={option.id} className={'language-choice ' + ((value.outputMode ?? 'video') === option.id ? 'is-selected' : '')}>
        <span className="flex justify-between gap-2"><span className="font-semibold">{option.name}</span><input type="radio" name="generation-mode" checked={(value.outputMode ?? 'video') === option.id} onChange={() => onChange({ ...value, outputMode: option.id })} /></span><span className="block text-xs text-gray-400 mt-2">{option.detail}</span>
      </label>)}
    </div></fieldset>
    <fieldset><legend className="text-sm font-semibold mb-3">Caption language</legend><div className="grid grid-cols-2 gap-3">
      {([{ id: 'hinglish', name: 'Hinglish', sample: 'Aaj kuch amazing banate hain', detail: 'Hindi + English, in Roman letters' }, { id: 'english', name: 'English', sample: 'Let’s make something amazing', detail: 'English captions' }] as const).map(option => <label key={option.id} className={'language-choice ' + (value.outputLanguage === option.id ? 'is-selected' : '')}>
        <span className="flex items-center justify-between gap-2"><span className="font-semibold">{option.name}</span><input type="radio" name="caption-output" value={option.id} checked={value.outputLanguage === option.id} onChange={() => onChange({ ...value, outputLanguage: option.id })} /></span>
        <span className="block text-sm mt-3 text-gray-200">{option.sample}</span><span className="block text-xs text-gray-400 mt-2">{option.detail}</span>
      </label>)}
    </div></fieldset>
    {value.outputMode === 'srt' ? <p className="text-sm text-gray-400">SRT includes words and timing. Fonts, colors and animations are added in your video editor.</p> : <details className="style-picker"><summary className="cursor-pointer text-sm font-semibold">Caption style <span className="text-gray-400 font-normal">· {templateName} · change</span></summary><div className="mt-4"><TemplateGallery selected={value.templateId} onSelect={t => onChange({ ...value, templateId: t.id })} /></div></details>}
    <label className="block text-sm font-semibold">Names and phrases (optional)
      <textarea className="input mt-2 w-full" rows={2} maxLength={1600} value={(value.vocabulary ?? []).join(',')} onChange={e => onChange({ ...value, vocabulary: e.target.value.split(',') })} placeholder="Minecraft Java Edition, search bar" aria-describedby="vocabulary-help" />
      <span id="vocabulary-help" className="block text-xs text-gray-400 font-normal mt-2">Separate up to 20 short phrases with commas. Use English spelling for English terms and Hindi script for Hindi phrases. Include only words spoken in your video.</span>
    </label>
  </div>;
}
