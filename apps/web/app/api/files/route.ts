import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { getCurrentUser } from '@/lib/session';
import { storage } from '@/lib/storage';
import { json } from '@/lib/api';

export const runtime = 'nodejs';

const MIME: Record<string, string> = {
  mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', mkv: 'video/x-matroska',
  wav: 'audio/wav', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  srt: 'text/plain', vtt: 'text/vtt', txt: 'text/plain', mp3: 'audio/mpeg', aac: 'audio/aac',
};

/** Parse a `Range: bytes=start-end` header. Returns null when malformed. */
function parseRange(header: string, size: number): { start: number; end: number } | null {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m) return null;
  const [, s, e] = m;
  if (s === '' && e === '') return null;
  let start: number, end: number;
  if (s === '') {
    // Suffix range: last N bytes.
    const n = Number(e);
    start = Math.max(0, size - n);
    end = size - 1;
  } else {
    start = Number(s);
    end = e === '' ? size - 1 : Math.min(Number(e), size - 1);
  }
  if (start > end || start >= size) return null;
  return { start, end };
}

/**
 * GET /api/files?key=... — streams a private file to the authenticated owner.
 * Ownership is enforced by the storage-key prefix (users/{userId}/...).
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return json({ error: 'Unauthorized' }, 401);

  const url = new URL(req.url);
  const key = url.searchParams.get('key');
  if (!key) return json({ error: 'Missing key' }, 400);

  // Isolation: only this user's own files (spec section 46).
  if (!key.startsWith(`users/${user.id}/`) || key.split('/').some(part => part === '..' || part === '.') || key.includes('\\')) {
    return json({ error: 'Forbidden' }, 403);
  }

  try {
    const store = await storage();
    if (store.kind === 's3') {
      const signed = await store.getSignedUrl(key);
      return Response.redirect(signed);
    }
    const local = await store.resolveLocal(key);
    const ext = key.split('.').pop() ?? 'mp4';
    const contentType = MIME[ext] ?? 'application/octet-stream';

    const meta = await stat(local);
    const fileSize = meta.size;

    // HTTP Range support (video seeking / progressive playback).
    const range = req.headers.get('range');
    if (range) {
      const r = parseRange(range, fileSize);
      if (!r) {
        return new Response(null, {
          status: 416,
          headers: { 'Content-Range': `bytes */${fileSize}` },
        });
      }
      const { start, end } = r;
      const chunkSize = end - start + 1;
      return new Response(createReadStream(local, { start, end }) as unknown as BodyInit, {
        status: 206,
        headers: {
          'Content-Type': contentType,
          'Accept-Ranges': 'bytes',
          'Content-Length': String(chunkSize),
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        },
      });
    }

    return new Response(createReadStream(local) as unknown as BodyInit, {
      headers: {
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(fileSize),
        'Cache-Control': 'private, no-store',
        ...(url.searchParams.get('download') === '1' ? { 'Content-Disposition': 'attachment; filename="clipx-export.' + ext + '"' } : {}),
      },
    });
  } catch {
    return json({ error: 'File not found.' }, 404);
  }
}
