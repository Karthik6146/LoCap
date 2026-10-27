import { prisma } from '@clipx/database';
import { getCurrentUser } from '@/lib/session';
import { storage } from '@/lib/storage';
import { json, apiError } from '@/lib/api';
export const runtime = 'nodejs';

export async function DELETE(_req: Request, ctx: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const result = await prisma.$transaction(async (tx) => {
      const project = await tx.project.findFirst({
        where: { id: ctx.params.id, userId: user.id },
        include: {
          videos: true, clips: true, exports: true, renders: true,
        },
      });
      if (!project) return { error: 'Project not found', status: 404 } as const;
      if (project.renders.some(job => !['queued', 'completed', 'failed'].includes(job.status))) {
        return { error: 'This project is currently processing. Wait for processing to finish, then delete it.', status: 409 } as const;
      }
      const keys = [
        ...project.videos.flatMap(v => [v.sourceKey, v.audioKey, v.proxyKey, v.thumbnailKey]),
        ...project.clips.flatMap(c => [c.proxyKey, c.thumbnailKey]),
        ...project.exports.map(e => e.outputKey),
        ...project.renders.map(j => j.outputKey),
      ].filter((key): key is string => !!key && key.startsWith('users/' + user.id + '/') && !key.includes('\\') && !key.split('/').some(part => part === '..' || part === '.'));
      // Cancel queued work and remove relational data together, before file cleanup.
      await tx.project.delete({ where: { id: project.id } });
      return { keys: [...new Set(keys)] };
    });
    if ('error' in result) return json({ error: result.error }, result.status);
    const store = await storage();
    const cleanup = await Promise.allSettled(result.keys.map(key => store.delete(key)));
    const cleanupFailures = cleanup.filter(r => r.status === 'rejected').length;
    if (cleanupFailures) console.warn('[delete-project] file cleanup failures:', cleanupFailures);
    return json({ success: true, cleanupFailures });
  } catch (err) { return apiError(err); }
}
