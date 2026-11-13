/**
 * Storage abstraction (spec sections 60, 46). S3-compatible object storage in
 * production; a local-filesystem backend for zero-dependency dev. Private by
 * default; reads/writes go through signed URLs or server-only paths.
 */

export interface Storage {
  readonly kind: 's3' | 'local';

  /** Write bytes/stream to a key. */
  put(key: string, body: Buffer | NodeJS.ReadableStream, opts?: { contentType?: string }): Promise<void>;

  /** Read a key's full bytes (server-side only). */
  get(key: string): Promise<Buffer>;

  /** Resolve a key to a local absolute path (local backend only). */
  resolveLocal(key: string): Promise<string>;

  /** Return a time-limited signed download URL for a key. */
  getSignedUrl(key: string, opts?: { expiresInSec?: number }): Promise<string>;

  /** Return a time-limited signed upload URL for a key. */
  getSignedUploadUrl(key: string, opts?: { expiresInSec?: number; contentType?: string }): Promise<string>;

  /** Delete a key. */
  delete(key: string): Promise<void>;

  /** True if this backend is usable (e.g. S3 endpoint reachable). */
  isAvailable(): Promise<boolean>;
}
