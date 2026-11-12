import { prisma } from '@clipx/database';
import Link from 'next/link';
import { ArrowRight, Plus } from 'lucide-react';
import { CountUp } from '@/components/ui';
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
      <div><h1>Make every word count</h1><p>Word-timed captions in English, Hindi or Hinglish</p></div>
      <Link href="/app/projects/new" className="btn btn-primary"><Plus size={16} strokeWidth={1.5} aria-hidden="true" /> New project</Link>
    </section>
    <div className="workspace-stats" aria-label="Workspace overview">
      <StatCard label="Projects" value={projectCount} />
      <StatCard label="Ready to edit" value={readyCount} />
      <StatCard label="Exports" value={exportCount} />
    </div>
    <section>
      <div className="workspace-section-heading"><div><h2>Recent projects</h2><p>Pick up where you left off</p></div><Link href="/app/projects">View all <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" /></Link></div>
      {projects.length ? <div className="project-grid">{projects.map(project => <ProjectCard key={project.id} project={project} />)}</div> :
        <div className="workspace-empty"><h3>Your next story starts here</h3><p>Upload a video, check the words and find your caption style.</p><Link href="/app/projects/new" className="btn btn-secondary">Create your first project</Link></div>}
    </section>
  </div>;
}

function StatCard({ label, value }: { label: string; value: number }) {
  return <div className="workspace-stat"><div><p>{label}</p><strong><CountUp value={value} /></strong></div></div>;
}
