import { prisma } from '@clipx/database';
import { getCurrentUser } from '@/lib/session';
import { json, apiError } from '@/lib/api';

export const runtime = 'nodejs';

/**
 * POST /api/projects/[id]/clips — generate clip suggestions for a video.
 * Upload processing only makes captions; clips are created on demand here via
 * an `analyze` RenderJob so failures can't abort caption work.
 */
export async function POST(req: Request, ctx: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const project = await prisma.project.findFirst({ where: { id: ctx.params.id, userId: user.id } });
    if (!project) return json({ error: 'Project not found.' }, 404);

    const body = (await req.json().catch(() => ({}))) as { videoId?: string };
    const video = body.videoId
      ? await prisma.video.findFirst({ where: { id: body.videoId, projectId: project.id, status: 'ready' } })
      : await prisma.video.findFirst({ where: { projectId: project.id, status: 'ready' }, orderBy: { createdAt: 'asc' } });
    if (!video) return json({ error: 'No processed (ready) video to analyze.' }, 409);
    if ((await prisma.transcript.count({ where: { videoId: video.id } })) === 0) {
      return json({ error: 'No transcript yet — wait for caption processing.' }, 409);
    }

    // Avoid duplicate analyze jobs for the same video.
    const existing = await prisma.renderJob.findFirst({
      where: { videoId: video.id, type: 'analyze', status: 'queued' },
    });
    if (existing) return json({ jobId: existing.id });

    const job = await prisma.renderJob.create({
      data: {
        projectId: project.id,
        userId: user.id,
        videoId: video.id,
        type: 'analyze',
        status: 'queued',
        message: 'Queued clip analysis',
      },
    });
    return json({ jobId: job.id }, 201);
  } catch (err) {
    return apiError(err);
  }
}