import { prisma } from '@clipx/database';
import { getCurrentUser } from '@/lib/session';
import { storage } from '@/lib/storage';
import { json, apiError } from '@/lib/api';

export const runtime = 'nodejs';

/**
 * DELETE /api/videos/[id]/delete — delete a single video, its stored files,
 * and its data (clips, captions, exports, transcript, renderJobs).
 */
export async function DELETE(
  req: Request,
  ctx: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const video = await prisma.video.findFirst({
      where: { id: ctx.params.id, project: { userId: user.id } },
      include: { clips: { select: { id: true, thumbnailKey: true, proxyKey: true } } },
    });
    if (!video) return json({ error: 'Video not found' }, 404);

    // Exports hang off clips, so resolve this video's by its clip ids.
    const clipIds = video.clips.map((c) => c.id);
    const exports = clipIds.length
      ? await prisma.export.findMany({ where: { clipId: { in: clipIds } }, select: { outputKey: true } })
      : [];

    // Remove stored files first (best-effort — a missing file must not fail the delete).
    const store = await storage();
    const keys = [
      video.sourceKey,
      video.audioKey,
      video.proxyKey,
      video.thumbnailKey,
      ...video.clips.flatMap((c) => [c.thumbnailKey, c.proxyKey]),
      ...exports.map((e) => e.outputKey),
    ].filter((k): k is string => Boolean(k));
    for (const key of keys) {
      try {
        await store.delete(key);
      } catch {
        // file already missing — safe to ignore during deletion
      }
    }

    // Delete cascade: clips, captions, exports, renderJobs, transcript, etc.
    await prisma.video.delete({ where: { id: ctx.params.id } });

    return json({ success: true });
  } catch (err) {
    return apiError(err);
  }
}