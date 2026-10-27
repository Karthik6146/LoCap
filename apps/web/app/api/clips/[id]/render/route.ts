import { prisma } from '@clipx/database';
import type { ExportSettings } from '@clipx/types';
import { getCurrentUser } from '@/lib/session';
import { json, apiError } from '@/lib/api';

export const runtime = 'nodejs';

/**
 * POST /api/clips/[id]/render — create an Export + RenderJob (type=render).
 * Frontend polls /api/jobs/[id] for real progress, then downloads the output.
 */
export async function POST(req: Request, ctx: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const clip = await prisma.clip.findFirst({
      where: { id: ctx.params.id, project: { userId: user.id } },
      include: { video: true, project: true },
    });
    if (!clip) return json({ error: 'Clip not found.' }, 404);

    const body = (await req.json().catch(() => ({}))) as { settings?: Partial<ExportSettings> };
    const settings: ExportSettings = {
      platform: 'youtube-shorts',
      aspect: (clip.aspect as ExportSettings['aspect']) || '9:16',
      width: clip.aspect === '16:9' ? 1920 : 1080,
      height: clip.aspect === '16:9' ? 1080 : 1920,
      fps: 30,
      codec: 'h264',
      quality: 'medium',
      burnCaptions: true,
      audio: { volume: 1, ducking: false },
      ...body.settings,
    };

    const exportRow = await prisma.export.create({
      data: {
        projectId: clip.projectId,
        clipId: clip.id,
        userId: user.id,
        platform: settings.platform,
        settings: JSON.stringify(settings),
        status: 'queued',
      },
    });

    await prisma.clip.update({ where: { id: clip.id }, data: { status: 'exporting' } });

    const job = await prisma.renderJob.create({
      data: {
        projectId: clip.projectId,
        userId: user.id,
        videoId: clip.videoId,
        clipId: clip.id,
        type: 'render',
        status: 'queued',
        message: 'Queued export',
        input: JSON.stringify({ settings, exportId: exportRow.id }),
      },
    });

    return json({ exportId: exportRow.id, jobId: job.id }, 201);
  } catch (err) {
    return apiError(err);
  }
}
