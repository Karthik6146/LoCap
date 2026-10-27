import { prisma } from '@clipx/database';
import { getCurrentUser } from '@/lib/session';
import { json, apiError } from '@/lib/api';

export const runtime = 'nodejs';

/** GET /api/jobs/[id] — poll a RenderJob's real status/progress. */
export async function GET(_req: Request, ctx: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const job = await prisma.renderJob.findFirst({
      where: { id: ctx.params.id, userId: user.id },
    });
    if (!job) return json({ error: 'Job not found.' }, 404);
    return json({
      id: job.id,
      status: job.status,
      progress: job.progress,
      message: job.message,
      error: job.error,
      outputKey: job.outputKey,
    });
  } catch (err) {
    return apiError(err);
  }
}
