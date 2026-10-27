export type CaptionOutput = 'hinglish' | 'english';
export interface GenerationOptions { outputLanguage: CaptionOutput; templateId: string; outputMode?: 'video' | 'srt'; vocabulary?: string[] }
export const CAPTION_TEMPLATE_IDS = ['bold-yellow-pop', 'karaoke-fill', 'pop-box', 'bounce-word', 'clean-minimal', 'neon-gaming', 'marker-highlight', 'typewriter', 'clean', 'gold', 'mint', 'editorial', 'boxed', 'electric', 'creator', 'minimal', 'rose', 'contrast', 'shout', 'punch', 'headline', 'sticker', 'whisper', 'subtitle-classic', 'soft-box', 'talk-show', 'interview', 'storyteller', 'quote-card', 'arcade', 'rage', 'level-up', 'gold-serif', 'noir', 'desi-pop', 'bollywood-marquee', 'hindi-bold-box', 'tez-karaoke', 'saaf', 'dhamaka'] as const;
export function parseGenerationOptions(value: unknown): GenerationOptions {
  if (!value || typeof value !== 'object') throw new Error('Choose a caption language and template.');
  const v = value as Record<string, unknown>;
  const outputLanguage = v.outputLanguage ?? 'hinglish';
  const templateId = v.templateId ?? 'clean';
  if (outputLanguage !== 'hinglish' && outputLanguage !== 'english') throw new Error('Choose English or Hinglish captions.');
  if (typeof templateId !== 'string' || !(CAPTION_TEMPLATE_IDS as readonly string[]).includes(templateId)) throw new Error('Unknown caption template.');
  if (v.outputMode !== undefined && v.outputMode !== 'video' && v.outputMode !== 'srt') throw new Error('Choose captioned video or SRT only.');
  let vocabulary: string[] | undefined;
  if (v.vocabulary !== undefined) {
    if (!Array.isArray(v.vocabulary) || v.vocabulary.length > 20 || v.vocabulary.some(p =>
      typeof p !== 'string' || p.length > 80 || /[\u0000-\u001f\u007f]/.test(p) ||
      p.trim().split(/\s+/).length > 5 || [...p].some(c => /\p{L}/u.test(c) && !/[\p{Script=Latin}\p{Script=Devanagari}]/u.test(c))
    )) throw new Error('Use up to 20 names or phrases, each at most 80 characters and 5 words, in English or Hindi.');
    vocabulary = [...new Set((v.vocabulary as string[]).map(p => p.trim()).filter(Boolean))];
  }
  return { outputLanguage, templateId, ...(v.outputMode !== undefined ? { outputMode: v.outputMode as 'video' | 'srt' } : {}), ...(vocabulary?.length ? { vocabulary } : {}) };
}
