import { prisma } from '@clipx/database';
import { parseGenerationOptions } from '@clipx/types';
import { getCurrentUser } from '@/lib/session';
import { json, apiError } from '@/lib/api';

export const runtime = 'nodejs';

/** POST /api/projects/[id]/process — enqueue the processing pipeline for a video. */
export async function POST(req: Request, ctx: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const body = (await req.json().catch(() => ({}))) as { videoId?: string; outputLanguage?: unknown; templateId?: unknown };
    let settings;
    try { settings = parseGenerationOptions(body); }
    catch (e) { return json({ error: (e as Error).message }, 400); }
    return await prisma.$transaction(async (tx) => {
      const project = await tx.project.findFirst({ where: { id: ctx.params.id, userId: user.id } });
      if (!project) return json({ error: 'Project not found.' }, 404);

      const video = body.videoId
        ? await tx.video.findFirst({ where: { id: body.videoId, projectId: project.id } })
        : await tx.video.findFirst({ where: { projectId: project.id }, orderBy: { createdAt: 'asc' } });
      if (!video) return json({ error: 'No video to process.' }, 404);


      // Avoid duplicate queued jobs for the same video.
      const existing = await tx.renderJob.findFirst({
        where: { videoId: video.id, type: 'pipeline', status: { in: ['queued', 'probing', 'extracting', 'transcribing', 'analyzing', 'rendering', 'uploading'] } },
      });
      if (existing) return json({ jobId: existing.id });

      await tx.project.update({ where: { id: project.id }, data: { status: 'processing' } });
      await tx.video.update({ where: { id: video.id }, data: { status: 'uploaded', error: null } });
      const job = await tx.renderJob.create({
        data: {
          projectId: project.id,
          userId: user.id,
          videoId: video.id,
          type: 'pipeline',
          status: 'queued',
          message: 'Queued',
          input: JSON.stringify(settings),
        },
      });
      return json({ jobId: job.id }, 201);
    });
  } catch (err) {
    return apiError(err);
  }
}
