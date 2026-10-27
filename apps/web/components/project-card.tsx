import Link from 'next/link';
import { DeleteProjectButton } from './ui';

type Project = {
  id: string;
  name: string;
  status: string;
  updatedAt: Date | string;
  videos: { thumbnailKey: string | null; originalFilename: string; metadata: string | null }[];
};

export function ProjectCard({ project }: { project: Project }) {
  const video = project.videos[0];
  const thumbnail = video?.thumbnailKey ? `/api/files?key=${encodeURIComponent(video.thumbnailKey)}` : null;
  let duration: number | undefined;
  try {
    const metadata: unknown = JSON.parse(video?.metadata ?? 'null');
    if (metadata && typeof metadata === 'object' && 'duration' in metadata && typeof metadata.duration === 'number' && Number.isFinite(metadata.duration) && metadata.duration > 0) duration = metadata.duration;
  } catch { /* Older videos may not have usable metadata. */ }
  const statuses: Record<string, string> = { ready: 'Ready to edit', processing: 'Processing', error: 'Needs attention', draft: 'Draft' };
  const status = statuses[project.status] ?? 'Draft';
  const updatedAt = new Date(project.updatedAt);
  const href = `/app/projects/${project.id}`;

  return <article className="project-card" data-project-card>
    <Link href={href} className="project-card-link" aria-label={`Edit project ${project.name}`}>
      <div className="project-card-media">
        {thumbnail ? <img src={thumbnail} alt={`Preview of ${project.name}`} loading="lazy" /> : <div className="project-card-placeholder" aria-hidden="true">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><rect x="3" y="4" width="18" height="16" rx="4" /><path d="m10 8 6 4-6 4Z" /></svg>
          <span>{video ? 'Preview unavailable' : 'Add your first video'}</span>
        </div>}
        <span className={`project-status project-status-${project.status}`}><span aria-hidden="true" />{status}</span>
        {duration !== undefined && <span className="project-duration">{Math.floor(duration / 60)}:{String(Math.floor(duration % 60)).padStart(2, '0')}</span>}
      </div>
      <div className="project-card-body">
        <h3 title={project.name}>{project.name}</h3>
        <p title={video?.originalFilename}>{video?.originalFilename ?? 'Upload a video to get started'}</p>
        <time dateTime={updatedAt.toISOString()}>Edited {updatedAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</time>
      </div>
    </Link>
    <div className="project-card-footer">
      <Link href={href} aria-label={`Open project ${project.name}`}>Open project <span aria-hidden="true">↗</span></Link>
      <DeleteProjectButton projectId={project.id} projectName={project.name} />
    </div>
  </article>;
}
