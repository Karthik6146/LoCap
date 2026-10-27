'use client';
import { assFontSize, captionPosition, fitCaptionStyle, presentationTime, wordPresentation } from '@clipx/captions';
import type { BurnGroup, CaptionStyle } from '@clipx/types';

export function CaptionOverlay({ group, style, time, width, height, scale = 1, interactive = false }: { group: BurnGroup; style: CaptionStyle; time: number; width: number; height: number; scale?: number; interactive?: boolean }) {
  style = fitCaptionStyle(group, style, width);
  const position = captionPosition(style, width, height);
  const at = presentationTime(group, style, time);
  return <div aria-hidden={interactive ? undefined : true} role={interactive ? 'button' : undefined} tabIndex={interactive ? 0 : undefined} aria-label={interactive ? 'Move caption' : undefined} aria-describedby={interactive ? 'caption-position' : undefined} title={interactive ? 'Drag to move captions. Use arrow keys for fine adjustments.' : undefined} data-caption-overlay className={'absolute whitespace-nowrap ' + (interactive ? 'pointer-events-auto touch-none select-none cursor-move outline outline-1 outline-transparent hover:outline-primary focus-visible:outline-primary' : 'pointer-events-none')} style={{
    left: position.x * scale, top: position.y * scale,
    transform: `translate(${position.translateX}, ${position.translateY})`,
    fontFamily: `"${style.font}", "Noto Sans Devanagari", sans-serif`,
    fontSize: style.fontSize * scale, fontWeight: style.fontWeight, lineHeight: 1.2,
    opacity: style.opacity ?? 1,
    background: style.background.enabled ? style.background.color + Math.round(style.background.opacity * 255).toString(16).padStart(2, '0') : undefined,
    padding: style.background.enabled ? 4 * scale : 0,
  }}>{group.words.map((word, i) => {
    const state = wordPresentation(word, group, style, at);
    return <span key={i}>{i > 0 ? ' ' : ''}<span data-active={state.active} style={{
      display: 'inline-block', fontFamily: `"${state.font}", "Noto Sans Devanagari", sans-serif`,
      fontSize: `${state.scale}em`, transform: `translateY(${state.lift * scale}px)`, opacity: state.opacity,
      color: state.color,
      background: state.marker ? style.highlightColor : undefined,
      lineHeight: state.marker ? assFontSize(state.font, 1) : undefined,
      boxShadow: state.marker ? `0 0 0 ${4 * scale}px ${style.highlightColor}` : undefined,
      WebkitTextStroke: style.background.enabled || state.marker ? undefined : `${style.stroke.width * scale}px ${style.stroke.color}`,
      paintOrder: 'stroke fill',
      textShadow: state.glow ? `0 0 ${state.glow * scale}px ${style.highlightColor}` : `${style.shadow.offsetY * scale}px ${style.shadow.offsetY * scale}px 0 ${style.shadow.color}`,
    }}>{state.visible}<span style={{ visibility: 'hidden' }}>{state.hidden}</span></span></span>;
  })}</div>;
}
