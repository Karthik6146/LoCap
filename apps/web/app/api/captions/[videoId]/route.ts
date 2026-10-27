import { prisma } from '@clipx/database';
import { captionsToSrt, captionsToVtt } from '@clipx/captions';
import { getCurrentUser } from '@/lib/session';
import { captionDocument, captionRevision } from '@/lib/captions';
import { json, apiError } from '@/lib/api';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(req: Request, ctx: { params: { videoId: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const video = await prisma.video.findFirst({ where: { id: ctx.params.videoId, project: { userId: user.id } } });
    if (!video) return json({ error: 'Video not found' }, 404);
    const rows = await prisma.caption.findMany({ where: { videoId: video.id, clipId: null }, orderBy: { order: 'asc' } });
    const format = new URL(req.url).searchParams.get('format') ?? 'json';
    if (format === 'json') return json({ ...captionDocument(rows), revision: captionRevision(rows) });
    if (!rows.length) return json({ error: 'No captions available. Generate or add captions first.' }, 404);
    if (!['srt', 'vtt', 'txt'].includes(format)) return json({ error: 'Invalid format' }, 400);
    const content = format === 'srt' ? captionsToSrt(rows) : format === 'vtt' ? captionsToVtt(rows) : rows.map((c) => c.text).join('\n');
    return new Response(content, { headers: { 'Content-Type': format === 'vtt' ? 'text/vtt; charset=utf-8' : 'text/plain; charset=utf-8', 'Content-Disposition': 'attachment; filename="captions.' + format + '"', 'Cache-Control': 'no-store' } });
  } catch (err) { return apiError(err); }
}

