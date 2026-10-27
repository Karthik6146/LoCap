import { prisma } from '@clipx/database';
import { getCurrentUser } from '@/lib/session';
import { redirect } from 'next/navigation';
import { Card } from '@/components/ui';
import Link from 'next/link';
export const dynamic = 'force-dynamic';
const STATUS: Record<string, string> = { queued: 'Queued', rendering: 'Rendering', ready: 'Ready', failed: 'Failed' };

async function getExports(userId: string) {
  return prisma.export.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { clip: { select: { id: true, title: true } }, project: { select: { id: true, name: true } } },
  });
}

export default async function ExportsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/app');
  const exports = await getExports(user.id);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">Exports</h1>
        <p className="text-gray-400 text-sm mt-1">All your rendered videos ready for download.</p>
      </div>

      {exports.length === 0 ? (
        <Card className="p-12 text-center">
          <h2 className="text-white font-semibold mb-2">No exports yet</h2>
          <p className="text-gray-400 text-sm mb-6">Process clips and export them to download.</p>
          <Link className="btn btn-primary" href="/app/projects">Go to projects</Link>
        </Card>
      ) : (
        <div className="space-y-3">
          {exports.map((e) => {
            const format = e.platform === 'srt' ? 'SRT' : 'MP4';
            const kind = e.platform === 'srt' ? 'Subtitles' : e.platform === 'captioned-video' ? 'Captioned video' : 'Clip';
            return (
            <Card key={e.id} className="p-4 flex flex-wrap items-center gap-x-4 gap-y-3">
              <span className={'export-format ' + (format === 'SRT' ? 'is-text' : '')} aria-hidden="true">{format}</span>
              <div className="flex-1 min-w-[12rem]">
                <h2 className="font-medium text-white truncate">{e.clip?.title ?? `${kind} · ${e.project.name}`}</h2>
                <p className="text-gray-400 text-sm">{format} file · {e.status === 'ready' && !e.outputKey ? 'File unavailable, export again from Caption studio' : STATUS[e.status] ?? e.status} · {e.createdAt.toLocaleString()}</p>
              </div>
              <div className="flex gap-2">
                {e.status === 'ready' && e.outputKey && (
                  <a className="btn btn-primary" href={`/api/files?download=1&key=${encodeURIComponent(e.outputKey)}`}>Download {format}</a>
                )}
                {e.status === 'failed' && <span className="text-red-300 text-sm">Failed: {e.error}</span>}
              </div>
            </Card>
          ); })}
        </div>
      )}
    </div>
  );
}
