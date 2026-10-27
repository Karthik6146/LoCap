/**
 * Clip generation & editing domain types.
 */

export type AspectRatio = '9:16' | '16:9' | '1:1' | '4:5';

export type Platform =
  | 'youtube-shorts' | 'instagram-reels' | 'tiktok'
  | 'facebook-reels' | 'x' | 'linkedin' | 'youtube';

export interface PlatformPreset {
  platform: Platform;
  aspect: AspectRatio;
  width: number;
  height: number;
  fps: number;
}

export const PLATFORM_PRESETS: Record<Platform, PlatformPreset> = {
  'youtube-shorts': { platform: 'youtube-shorts', aspect: '9:16', width: 1080, height: 1920, fps: 30 },
  'instagram-reels': { platform: 'instagram-reels', aspect: '9:16', width: 1080, height: 1920, fps: 30 },
  tiktok: { platform: 'tiktok', aspect: '9:16', width: 1080, height: 1920, fps: 30 },
  'facebook-reels': { platform: 'facebook-reels', aspect: '9:16', width: 1080, height: 1920, fps: 30 },
  x: { platform: 'x', aspect: '9:16', width: 1080, height: 1920, fps: 30 },
  linkedin: { platform: 'linkedin', aspect: '1:1', width: 1080, height: 1080, fps: 30 },
  youtube: { platform: 'youtube', aspect: '16:9', width: 1920, height: 1080, fps: 30 },
};

/** Sub-scores that compose the overall viral score. */
export interface ViralScores {
  overall: number;      // 0..100
  hook: number;
  payoff: number;
  emotion: number;
  clarity: number;
  shareability: number;
}

/** A candidate clip suggested by the AI (or a manually chosen segment). */
export interface ClipSuggestion {
  id: string;
  start: number;
  end: number;
  duration: number;
  title: string;
  reason: string;
  scores: ViralScores;
  /** Keywords / topics detected in the segment. */
  topics: string[];
  /** Detected emotion tags, e.g. "funny", "intense", "informative". */
  emotionTags: string[];
  /** Whether this candidate comes from the AI provider or a user's manual selection. */
  source: 'ai' | 'manual';
}

/** A single contiguous segment of a clip (non-destructive editing). */
export interface ClipSegment {
  id: string;
  /** Offset in source video (seconds). */
  sourceStart: number;
  sourceEnd: number;
  /** Position in the assembled clip timeline (seconds). */
  timelineStart: number;
  timelineEnd: number;
}

export interface Clip {
  id: string;
  projectId: string;
  videoId: string;
  title: string;
  /** Duration in seconds. */
  duration: number;
  segments: ClipSegment[];
  aspect: AspectRatio;
  scores?: ViralScores;
  thumbnailUrl?: string | null;
  proxyUrl?: string | null;
  status: 'draft' | 'processing' | 'ready' | 'exporting' | 'error';
  createdAt: string;
  updatedAt: string;
}
