import { prisma } from '@clipx/database';
import { getCurrentUser } from '@/lib/session';
import { redirect } from 'next/navigation';
import { Card } from '@/components/ui';
import Link from 'next/link';

async function getClips(userId: string) {
  return prisma.clip.findMany({
    where: { project: { userId } },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { project: { select: { id: true, name: true } } },
  });
}

export default async function ClipsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/app');
  const clips = await getClips(user.id);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">AI Clips</h1>
        <p className="text-gray-400 text-sm mt-1">All generated clips across your projects.</p>
      </div>

      {clips.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="text-5xl mb-4">✂️</div>
          <h3 className="text-white font-semibold mb-2">No clips yet</h3>
          <p className="text-gray-400 text-sm mb-6">Upload a video and let AI find the best moments.</p>
          <Link className="btn btn-primary" href="/app/projects/new">Create Project</Link>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {clips.map((c) => (
            <Link key={c.id} href={`/app/clips/${c.id}`} className="card p-3 hover:border-primary/50 transition-colors">
              <div className="aspect-video rounded-lg bg-surface2 mb-3 relative overflow-hidden">
                {c.thumbnailKey ? (
                  <img src={`/api/files?key=${encodeURIComponent(c.thumbnailKey)}`} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-500 text-2xl">🎬</div>
                )}
                <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/70 text-xs text-white">
                  {c.duration.toFixed(0)}s
                </div>
              </div>
              <h4 className="font-medium text-white text-sm truncate mb-1">{c.title}</h4>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="px-1.5 py-0.5 rounded bg-surface2">{c.project.name}</span>
                <span className="text-gray-400">{c.status}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}