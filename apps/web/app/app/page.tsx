import { prisma } from '@clipx/database';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/session';
import { ProjectCard } from '@/components/project-card';
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const [projects, projectCount, readyCount, exportCount] = await Promise.all([
    prisma.project.findMany({
      where: { userId: user.id }, orderBy: { updatedAt: 'desc' }, take: 6,
      include: { videos: { orderBy: { createdAt: 'asc' }, select: { thumbnailKey: true, originalFilename: true, metadata: true } } },
    }),
    prisma.project.count({ where: { userId: user.id } }),
    prisma.project.count({ where: { userId: user.id, status: 'ready' } }),
    prisma.export.count({ where: { userId: user.id, status: 'ready' } }),
  ]);

  return <div className="workspace-overview">
    <section className="workspace-heading">
      <div><p className="workspace-eyebrow">Your workspace</p><h1>Make every word count.</h1><p>English or Hinglish. Your videos, your caption style.</p></div>
      <Link href="/app/projects/new" className="btn btn-primary"><span aria-hidden="true">＋</span> New project</Link>
    </section>
    <div className="workspace-stats" aria-label="Workspace overview">
      <StatCard label="Projects" value={projectCount} path="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
      <StatCard label="Ready to edit" value={readyCount} path="m8 12 3 3 5-6 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0" />
      <StatCard label="Exports" value={exportCount} path="M12 3v12 M7 10l5 5 5-5 M4 16v5h16v-5" />
    </div>
    <section>
      <div className="workspace-section-heading"><div><h2>Recent projects</h2><p>Pick up where you left off.</p></div><Link href="/app/projects">View all <span aria-hidden="true">→</span></Link></div>
      {projects.length ? <div className="project-grid">{projects.map(project => <ProjectCard key={project.id} project={project} />)}</div> :
        <div className="workspace-empty"><h3>Your next story starts here.</h3><p>Upload a video, check the words and find your caption style.</p><Link href="/app/projects/new" className="btn btn-primary">Create your first project</Link></div>}
    </section>
  </div>;
}

function StatCard({ label, value, path }: { label: string; value: number; path: string }) {
  return <div className="workspace-stat"><span className="workspace-stat-icon" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={path} /></svg></span><div><p>{label}</p><strong>{value}</strong></div></div>;
}
