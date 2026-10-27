/**
 * Export settings & social media domain types.
 */

import type { AspectRatio, Platform } from './clip';

export type ExportCodec = 'h264' | 'h265';
export type ExportQuality = 'low' | 'medium' | 'high';

export interface ExportSettings {
  platform: Platform;
  aspect: AspectRatio;
  width: number;
  height: number;
  fps: number;
  codec: ExportCodec;
  quality: ExportQuality;
  bitrate?: string;        // e.g. "8M"
  /** Burn captions into the video. */
  burnCaptions: boolean;
  captionStyleId?: string | null;
  audio: {
    volume: number;
    musicVolume?: number;
    ducking: boolean;
  };
}

export interface GeneratedPostContent {
  titles: string[];
  instagramCaption: string;
  youtubeDescription: string;
  tiktokCaption: string;
  hashtags: string[];
  keywords: string[];
}

export interface ScheduledPost {
  id: string;
  userId: string;
  projectId: string;
  platform: Platform;
  accountId: string;
  scheduledFor: string;
  caption: string;
  hashtags: string[];
  thumbnailKey?: string | null;
  status: 'scheduled' | 'published' | 'failed';
}
