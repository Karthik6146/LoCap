import { prisma } from '@clipx/database';
import { getCurrentUser } from '@/lib/session';
import { json, apiError } from '@/lib/api';

export const runtime = 'nodejs';

/** GET /api/projects — list the current user's projects with summaries. */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const projects = await prisma.project.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
      include: {
        videos: { select: { id: true, thumbnailKey: true, originalFilename: true, status: true, metadata: true } },
        clips: { select: { id: true, title: true, duration: true, thumbnailKey: true, status: true } },
      },
    });
    return json(projects);
  } catch (err) {
    return apiError(err);
  }
}

/** POST /api/projects — create a blank project. */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const body = (await req.json().catch(() => ({}))) as { name?: string };
    const project = await prisma.project.create({
      data: { userId: user.id, name: body.name || 'Untitled project' },
    });
    return json(project, 201);
  } catch (err) {
    return apiError(err);
  }
}
