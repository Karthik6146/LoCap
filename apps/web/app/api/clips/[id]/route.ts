import { prisma } from '@clipx/database';
import { getCurrentUser } from '@/lib/session';
import { json, apiError } from '@/lib/api';

export const runtime = 'nodejs';

/** Load a clip ensuring ownership via project → user. */
async function ownedClip(userId: string, id: string) {
  return prisma.clip.findFirst({
    where: { id, project: { userId } },
    include: {
      segments: { orderBy: { timelineStart: 'asc' } },
      captions: { orderBy: { order: 'asc' } },
      video: { include: { transcript: { include: { words: { orderBy: { index: 'asc' } } } } } },
      project: { include: { user: { select: { id: true } } } },
    },
  });
}

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const clip = await ownedClip(user.id, ctx.params.id);
    if (!clip) return json({ error: 'Clip not found.' }, 404);
    return json({
      ...clip,
      scores: clip.scores ? JSON.parse(clip.scores as string) : null,
      captions: clip.captions.map((c) => ({ ...c, words: JSON.parse(c.words as string) })),
    });
  } catch (err) {
    return apiError(err);
  }
}

interface SegmentPatch { sourceStart: number; sourceEnd: number; timelineStart: number; timelineEnd: number }
interface CaptionPatch { id?: string; script?: string; text: string; start: number; end: number; grouping?: string; order: number; styleId: string; words: unknown[] }

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const clip = await prisma.clip.findFirst({ where: { id: ctx.params.id, project: { userId: user.id } } });
    if (!clip) return json({ error: 'Clip not found.' }, 404);

    const body = (await req.json().catch(() => ({}))) as {
      title?: string; aspect?: string; segments?: SegmentPatch[]; captions?: CaptionPatch[];
    };

    const updates: Record<string, unknown> = {};
    if (body.title !== undefined) updates.title = body.title;
    if (body.aspect !== undefined) updates.aspect = body.aspect;

    if (body.segments) {
      await prisma.clipSegment.deleteMany({ where: { clipId: clip.id } });
      await prisma.clipSegment.createMany({
        data: body.segments.map((s) => ({ ...s, clipId: clip.id })),
      });
      const dur = body.segments.reduce((a, s) => a + (s.timelineEnd - s.timelineStart), 0);
      updates.duration = Math.round(dur * 100) / 100;
    }

    if (body.captions) {
      await prisma.caption.deleteMany({ where: { clipId: clip.id } });
      await prisma.caption.createMany({
        data: body.captions.map((c) => ({
          clipId: clip.id,
          script: c.script ?? 'hi-latn',
          text: c.text,
          start: c.start,
          end: c.end,
          grouping: c.grouping ?? 'auto',
          order: c.order,
          styleId: c.styleId,
          words: JSON.stringify(c.words),
        })),
      });
    }

    const updated = await prisma.clip.update({ where: { id: clip.id }, data: updates });
    return json(updated);
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(_req: Request, ctx: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const clip = await prisma.clip.findFirst({ where: { id: ctx.params.id, project: { userId: user.id } } });
    if (!clip) return json({ error: 'Clip not found.' }, 404);
    await prisma.clip.delete({ where: { id: clip.id } });
    return json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
