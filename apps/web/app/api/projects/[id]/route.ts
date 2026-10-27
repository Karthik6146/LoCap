import { prisma } from '@clipx/database';
import { getCurrentUser } from '@/lib/session';
import { json, apiError } from '@/lib/api';

export const runtime = 'nodejs';

/** GET /api/projects/[id] — get a single project with videos and clips. */
export async function GET(
  req: Request,
  ctx: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const project = await prisma.project.findFirst({
      where: { id: ctx.params.id, userId: user.id },
      include: {
        videos: { orderBy: { createdAt: 'desc' }, include: { _count: { select: { captions: { where: { clipId: null } } } } } },
        clips: { orderBy: { order: 'asc' } },
        renders: { where: { type: 'pipeline', status: 'completed' }, orderBy: { createdAt: 'desc' }, take: 1, select: { input: true } },
      },
    });
    if (!project) return json({ error: 'Project not found' }, 404);

    return json(project);
  } catch (err) {
    return apiError(err);
  }
}
