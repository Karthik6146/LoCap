import { prisma } from '@clipx/database';
import { getCurrentUser } from '@/lib/session';
import { redirect } from 'next/navigation';
import { ProjectCard } from '@/components/project-card';
import Link from 'next/link';
export const dynamic = 'force-dynamic';

export default async function ProjectsPage({ searchParams }: { searchParams: { q?: string | string[] } }) {
  const user = await getCurrentUser();
  if (!user) redirect('/app');
  const query = typeof searchParams.q === 'string' ? searchParams.q.trim().slice(0, 100) : '';
  const projects = await prisma.project.findMany({
    where: { userId: user.id, ...(query ? { name: { contains: query } } : {}) },
    orderBy: { updatedAt: 'desc' },
    include: { videos: { orderBy: { createdAt: 'asc' }, select: { thumbnailKey: true, originalFilename: true, metadata: true } } },
  });

  return <div className="workspace-overview">
    <div className="workspace-heading"><div><p className="workspace-eyebrow">Your library</p><h1>Projects</h1><p>A home for every video you’re working on.</p></div><Link href="/app/projects/new" className="btn btn-primary"><span aria-hidden="true">＋</span> New project</Link></div>
    <div className="project-library-toolbar">
      <p>{projects.length} {projects.length === 1 ? 'project' : 'projects'}{query ? ' found' : ''}</p>
      <form action="/app/projects" className="project-search" role="search">
        <label htmlFor="project-search" className="sr-only">Search projects</label>
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg>
        <input id="project-search" name="q" type="search" placeholder="Search your projects" defaultValue={query} maxLength={100} />
        <button type="submit">Search</button>
      </form>
    </div>
    {projects.length ? <div className="project-grid">{projects.map(project => <ProjectCard key={project.id} project={project} />)}</div> : <div className="workspace-empty">
      <h2>{query ? 'No matching projects' : 'Your library is ready for its first video.'}</h2><p>{query ? 'Try another name or return to all your projects.' : 'Upload a video to start creating your captions.'}</p>
      <Link href={query ? '/app/projects' : '/app/projects/new'} className="btn btn-primary">{query ? 'Clear search' : 'Create your first project'}</Link>
    </div>}
  </div>;
}
