/**
 * Non-destructive timeline model (sections 27, 41).
 */

export type TrackKind =
  | 'video' | 'captions' | 'text' | 'broll' | 'images' | 'music' | 'sfx';

export type TimelineItemKind =
  | 'video' | 'caption' | 'text' | 'broll' | 'image' | 'music' | 'sfx' | 'transition';

export interface TimelineItem {
  id: string;
  kind: TimelineItemKind;
  track: TrackKind;
  /** Start in assembled-clip seconds. */
  start: number;
  /** End in assembled-clip seconds. */
  end: number;
  /** Non-destructive: source media range (seconds). */
  sourceStart?: number;
  sourceEnd?: number;
  /** Asset reference (MediaAsset id). */
  assetId?: string | null;
  /** Opaque payload — e.g. caption id, text content, style. */
  payload?: Record<string, unknown>;
  muted?: boolean;
  volume?: number;
}

export interface TimelineTrack {
  id: string;
  kind: TrackKind;
  name: string;
  muted?: boolean;
  locked?: boolean;
  items: TimelineItem[];
}

export interface Timeline {
  id: string;
  projectId: string;
  /** Duration of the assembled clip in seconds. */
  duration: number;
  tracks: TimelineTrack[];
  updatedAt: string;
}
