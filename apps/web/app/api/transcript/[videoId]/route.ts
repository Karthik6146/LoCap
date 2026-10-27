import { prisma } from '@clipx/database';
import { getCurrentUser } from '@/lib/session';
import { json, apiError } from '@/lib/api';

export const runtime = 'nodejs';

/** Load a transcript ensuring ownership via the video → project → user chain. */
async function ownedTranscript(userId: string, videoId: string) {
  const video = await prisma.video.findFirst({
    where: { id: videoId, project: { userId } },
    include: { transcript: { include: { words: { orderBy: { index: 'asc' } } } } },
  });
  return video?.transcript ?? null;
}

/** GET /api/transcript/[videoId] — transcript + word-level data. */
export async function GET(_req: Request, ctx: { params: { videoId: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const transcript = await ownedTranscript(user.id, ctx.params.videoId);
    if (!transcript) return json({ error: 'Transcript not ready yet.' }, 404);
    const data = transcript.data ? JSON.parse(transcript.data as string) : null;
    return json({ ...transcript, data });
  } catch (err) {
    return apiError(err);
  }
}

interface WordPatch { id: string; text?: string; start?: number; end?: number; confidence?: number; isFiller?: boolean }

/** PATCH /api/transcript/[videoId] — apply word-level edits (timing preserved). */
export async function PATCH(req: Request, ctx: { params: { videoId: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const transcript = await ownedTranscript(user.id, ctx.params.videoId);
    if (!transcript) return json({ error: 'Transcript not ready yet.' }, 404);

    const body = (await req.json().catch(() => ({}))) as { words?: WordPatch[] };
    if (!Array.isArray(body.words)) return json({ error: 'Invalid payload.' }, 400);

    const ownedIds = new Set(transcript.words.map((w) => w.id));
    for (const patch of body.words) {
      if (!ownedIds.has(patch.id)) continue; // never touch others' words
      await prisma.transcriptWord.update({
        where: { id: patch.id },
        data: {
          ...(patch.text !== undefined ? { text: patch.text } : {}),
          ...(patch.start !== undefined ? { start: patch.start } : {}),
          ...(patch.end !== undefined ? { end: patch.end } : {}),
          ...(patch.confidence !== undefined ? { confidence: patch.confidence } : {}),
          ...(patch.isFiller !== undefined ? { isFiller: patch.isFiller } : {}),
        },
      });
    }
    return json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
