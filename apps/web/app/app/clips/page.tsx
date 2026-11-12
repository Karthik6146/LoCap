import { prisma } from '@clipx/database';
import { getCurrentUser } from '@/lib/session';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Film, Scissors } from 'lucide-react';

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
        <h1 className="font-display text-3xl font-medium tracking-tight text-gray-100">Clips</h1>
        <p className="text-gray-400 text-sm mt-1">Generated clips across your projects</p>
      </div>

      {clips.length === 0 ? (
        <div className="workspace-empty">
          <Scissors size={24} strokeWidth={1.5} aria-hidden="true" className="mx-auto mb-4 text-gray-500" />
          <h3 className="text-gray-100">No clips yet</h3>
          <p>Upload a video and generate clips from its strongest moments</p>
          <Link className="btn btn-primary" href="/app/projects/new">Create project</Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {clips.map((c) => (
            <Link key={c.id} href={`/app/clips/${c.id}`} className="card p-4 hover:border-gray-500 transition-colors">
              <div className="aspect-video rounded-xl bg-surface2 mb-3 relative overflow-hidden">
                {c.thumbnailKey ? (
                  <img src={`/api/files?key=${encodeURIComponent(c.thumbnailKey)}`} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-500">
                    <Film size={24} strokeWidth={1.5} aria-hidden="true" />
                  </div>
                )}
                <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-md bg-black/70 text-xs text-gray-100 tabular">
                  {c.duration.toFixed(0)}s
                </div>
              </div>
              <h4 className="font-medium text-gray-100 text-sm truncate mb-1">{c.title}</h4>
              <p className="text-xs text-gray-500 truncate">
                {c.project.name} · <span className="capitalize">{c.status}</span>
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}