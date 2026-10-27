import { prisma } from '@clipx/database';
import { validateDocument } from '@clipx/captions';
import { getCurrentUser } from '@/lib/session';
import { captionDocument, captionRevision } from '@/lib/captions';
import { json, apiError } from '@/lib/api';
export async function POST(req: Request, ctx: { params: { videoId: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const body = await req.json();
    return await prisma.$transaction(async (tx) => {
      const video = await tx.video.findFirst({ where: { id: ctx.params.videoId, project: { userId: user.id } } });
      if (!video) return json({ error: 'Video not found' }, 404);
      const rows = await tx.caption.findMany({ where: { videoId: video.id, clipId: null }, orderBy: { order: 'asc' } });
      if (!rows.length) return json({ error: 'Add captions before exporting.' }, 400);
      if (body.revision !== captionRevision(rows)) return json({ error: 'Save your latest captions before exporting.' }, 409);
      const document = captionDocument(rows);
      validateDocument(document, JSON.parse(video.metadata ?? '{}').duration ?? 0);
      const output = await tx.export.create({ data: { userId: user.id, projectId: video.projectId, platform: 'captioned-video', settings: JSON.stringify({ videoId: video.id, revision: body.revision, resolution: 'source' }) } });
      const job = await tx.renderJob.create({ data: { userId: user.id, projectId: video.projectId, videoId: video.id, type: 'caption', input: JSON.stringify({ document, exportId: output.id }), message: 'Queued caption export' } });
      return json({ jobId: job.id }, 201);
    });
  } catch (err) { return apiError(err); }
}
