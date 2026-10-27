/**
 * Shared runtime configuration constants & file-type utilities.
 */

/** Allowed upload containers (spec section 6). */
export const ALLOWED_VIDEO_EXTENSIONS = ['mp4', 'mov', 'webm', 'mkv'] as const;
export type AllowedVideoExtension = (typeof ALLOWED_VIDEO_EXTENSIONS)[number];

/** Max upload size, in bytes (2 GB). */
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024;

export function isAllowedVideoExtension(ext: string): ext is AllowedVideoExtension {
  return (ALLOWED_VIDEO_EXTENSIONS as readonly string[]).includes(ext.toLowerCase());
}

export function fileExtension(filename: string): string {
  const i = filename.lastIndexOf('.');
  return i === -1 ? '' : filename.slice(i + 1).toLowerCase();
}
