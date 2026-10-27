/**
 * Video metadata & processing domain types.
 */

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  fps: number;
  codec: string;
  audioCodec?: string | null;
  bitrate?: number;
  sizeBytes: number;
  container: string;
}

export type VideoStatus =
  | 'uploaded' | 'probing' | 'extracting' | 'transcribing'
  | 'analyzing' | 'ready' | 'error';

export interface Video {
  id: string;
  projectId: string;
  originalFilename: string;
  /** S3 key of the source file. */
  sourceKey: string;
  /** S3 key of the extracted 16kHz WAV used for transcription. */
  audioKey?: string | null;
  /** S3 key of the proxy video used in the editor. */
  proxyKey?: string | null;
  thumbnailKey?: string | null;
  metadata?: VideoMetadata | null;
  status: VideoStatus;
  error?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type RenderJobStatus =
  | 'queued' | 'probing' | 'extracting' | 'transcribing' | 'analyzing'
  | 'cutting' | 'reframing' | 'rendering' | 'uploading' | 'completed' | 'failed';

export interface RenderJob {
  id: string;
  projectId: string;
  userId: string;
  videoId: string;
  /** Optional clip id this job renders. */
  clipId?: string | null;
  status: RenderJobStatus;
  /** 0..100 real progress from the backend. */
  progress: number;
  /** Human-readable stage message. */
  message: string;
  /** Output S3 key when completed. */
  outputKey?: string | null;
  error?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ProcessStage =
  | 'uploaded' | 'probing' | 'extracting' | 'transcribing'
  | 'analyzing' | 'ready' | 'error';
