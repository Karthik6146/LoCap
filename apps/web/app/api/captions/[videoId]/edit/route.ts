import { prisma } from '@clipx/database';
import { validateDocument, type CaptionDocument } from '@clipx/captions';
import { getCurrentUser } from '@/lib/session';
import { captionRevision } from '@/lib/captions';
import { json, apiError } from '@/lib/api';
export const runtime = 'nodejs';
export async function PUT(req: Request, ctx: { params: { videoId: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const body = await req.json() as { revision: string; document: CaptionDocument };
    return await prisma.$transaction(async (tx) => {
      const video = await tx.video.findFirst({ where: { id: ctx.params.videoId, project: { userId: user.id } } });
      if (!video) return json({ error: 'Video not found' }, 404);
      const rows = await tx.caption.findMany({ where: { videoId: video.id, clipId: null }, orderBy: { order: 'asc' } });
      if (body.revision !== captionRevision(rows)) return json({ error: 'Captions changed in another session. Reload before saving.' }, 409);
      const active = await tx.renderJob.count({ where: { videoId: video.id, type: 'pipeline', status: { notIn: ['completed', 'failed'] } } });
      if (active) return json({ error: 'Wait for caption generation to finish before saving.' }, 409);
      try { validateDocument(body.document, JSON.parse(video.metadata ?? '{}').duration ?? 0); }
      catch (err) { return json({ error: (err as Error).message }, 400); }
      const doc = body.document;
      await tx.caption.deleteMany({ where: { videoId: video.id, clipId: null } });
      for (const [order, c] of doc.captions.entries()) {
        await tx.caption.create({ data: { videoId: video.id, text: c.text, start: c.start, end: c.end, words: JSON.stringify(c.words), script: 'mixed', grouping: 'custom', order, styleId: 'editor', data: JSON.stringify({ style: doc.style }) } });
      }
      const saved = await tx.caption.findMany({ where: { videoId: video.id, clipId: null }, orderBy: { order: 'asc' } });
      return json({ revision: captionRevision(saved) });
    });
  } catch (err) { return apiError(err); }
}

