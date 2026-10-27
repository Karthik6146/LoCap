'use client';

import { useState, useEffect } from 'react';
import { Spinner, Card } from '@/components/ui';
import Link from 'next/link';
import { GenerationSettings } from '@/components/generation-options';
import { parseGenerationOptions, type GenerationOptions } from '@clipx/types';
import { useRouter } from 'next/navigation';

interface Project {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  videos: Array<{
    id: string;
    originalFilename: string;
    thumbnailKey: string | null;
    proxyKey: string | null;
    status: string;
    metadata: string | null;
    error: string | null;
    _count: { captions: number };
  }>;
  clips: Array<{
    id: string;
    title: string;
    duration: number;
    thumbnailKey: string | null;
    status: string;
    order: number;
  }>;
}

export default function ProjectDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [settings, setSettings] = useState<GenerationOptions>({ outputLanguage: 'hinglish', templateId: 'gold' });
  const [jobMessage, setJobMessage] = useState('');
  const [error, setError] = useState('');
  async function retry(videoId: string) {
    if (!confirm('Transcribe the original audio again? Existing caption edits will be replaced after successful transcription.')) return;
    setProcessing(true); setError('');
    try {
      const res = await fetch('/api/projects/' + params.id + '/process', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videoId, ...settings }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await pollJobUntilDone(data.jobId);
      router.push('/app/captions/' + videoId);
    } catch (e) { setError((e as Error).message); }
    finally { setProcessing(false); }
  }

  useEffect(() => {
    fetch(`/api/projects/${params.id}`)
      .then((res) => {
        if (!res.ok) throw new Error('Not found');
        return res.json();
      })
      .then((data) => {
        setProject(data);
        if (data.renders?.[0]?.input) setSettings(parseGenerationOptions(JSON.parse(data.renders[0].input)));
        setLoading(false);
      })
      .catch(() => {
        window.location.href = '/app/projects';
      });
  }, [params.id]);

  const handleDeleteProject = async () => {
    if (!confirm('Delete this project and all its videos/clips?')) return;
    setDeleting('project');
    try {
      const res = await fetch(`/api/projects/${params.id}/delete`, { method: 'DELETE' });
      if (res.ok) window.location.href = '/app/projects';
      else alert('Failed to delete project');
    } finally { setDeleting(null); }
  };

  const handleDeleteVideo = async (videoId: string) => {
    if (!confirm('Remove this video and its clips/captions? The project itself will be kept.')) return;
    setDeleting(`video-${videoId}`);
    try {
      const res = await fetch(`/api/videos/${videoId}/delete`, { method: 'DELETE' });
      if (res.ok) window.location.reload();
      else alert('Failed to delete video');
    } finally { setDeleting(null); }
  };

  const pollJobUntilDone = (jobId: string) =>
    new Promise<void>((resolve, reject) => {
      const check = async () => {
        try {
          const r = await fetch(`/api/jobs/${jobId}`);
          const j = await r.json();
          if (!r.ok) throw new Error(j.error);
          setJobMessage(j.message + ' (' + j.progress + '%)');
          if (j.status === 'completed') return resolve();
          if (j.status === 'failed') return reject(new Error(j.error || 'Job failed'));
          setTimeout(check, 2000);
        } catch (e) { reject(e); }
      };
      check();
    });

  // Captions are made on upload; clips are generated on demand here.
  const handleGenerateClips = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/projects/${params.id}/clips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start clip generation');
      await pollJobUntilDone(data.jobId);
      window.location.reload();
    } catch (e: any) {
      alert(e.message);
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="text-primary" />
      </div>
    );
  }

  if (!project) return null;

  const video = project.videos[0];
  const clipCount = project.clips.length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">{project.name}</h1>
          <p className="text-gray-400 text-sm mt-1">
            {video?.status === 'ready'
              ? clipCount > 0
                ? `Captions ready • ${project.clips.length} clips generated`
                : 'Captions ready • Generate clips when you\'re ready'
              : video && !['ready', 'error'].includes(video.status)
              ? 'Processing captions...'
              : video?.status === 'error' ? 'Processing failed - retry or edit captions' : 'Waiting for upload'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {video?.status === 'ready' && clipCount === 0 && (
            <button className="btn btn-ghost" onClick={handleGenerateClips} disabled={generating}>
              {generating ? 'Generating…' : 'Generate clips'}
            </button>
          )}
          {video?.status === 'ready' && clipCount > 0 && (
            <Link className="btn btn-ghost" href={`/app/clips/${project.clips[0]?.id}`}>View clips</Link>
          )}
          <Link className="btn btn-ghost" href="/app/projects/new">+ New project</Link>
          <button className="btn btn-ghost project-danger" onClick={handleDeleteProject} disabled={deleting === 'project'}>
            <TrashIcon />{deleting === 'project' ? 'Deleting…' : 'Delete project'}
          </button>
        </div>
      </div>

      {video && <div className="card p-4 flex flex-wrap items-center gap-3">
        <Link className="btn btn-primary" href={'/app/captions/' + video.id}>Review & edit captions</Link>
        <StatusBadge status={video.status} />
        {['error', 'ready'].includes(video.status) && <details className="w-full"><summary className="cursor-pointer py-3 font-semibold">Generate captions from audio</summary><fieldset disabled={processing} className="space-y-5 pt-3 max-w-3xl"><GenerationSettings value={settings} onChange={setSettings} /><button className="btn btn-primary" disabled={processing} onClick={() => retry(video.id)}>{processing ? 'Generating captions…' : 'Generate selected captions'}</button></fieldset></details>}
        {processing && <p role="status">{jobMessage}</p>}
        {(error || video.error) && <p role="alert" className="text-red-300">{error || video.error}</p>}
        <p className="text-sm text-gray-400">The preview below is the initial generation. Export your latest edits from Caption studio.</p>
      </div>}
      {/* Video status */}
      {video ? (
        <Card className="p-6">
          {video.status === 'ready' && video.proxyKey ? (
            <div className="space-y-4">
              <div className="flex justify-center">
                <video
                  key={video.proxyKey}
                  src={`/api/files?key=${encodeURIComponent(video.proxyKey)}`}
                  controls
                  playsInline
                  className="project-video-preview rounded-xl bg-black object-contain"
                />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="mr-auto">
                  <h3 className="font-semibold text-white">{video.originalFilename}</h3>
                  <p className="text-sm text-gray-400">
                    Captioned video • {video.metadata ? `${JSON.parse(video.metadata as string).width}×${JSON.parse(video.metadata as string).height}` : '1080×1920'}
                  </p>
                </div>
                <Link className="btn btn-ghost" href={`/app/captions/${video.id}#caption-position`}>Adjust caption position</Link>
                <button className="btn btn-ghost project-danger" onClick={() => handleDeleteVideo(video.id)} disabled={deleting?.startsWith('video-')}>
                  <TrashIcon />Remove video only
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="w-full lg:w-64 aspect-video rounded-xl bg-surface2 relative overflow-hidden flex-shrink-0">
                {video.thumbnailKey ? (
                  <img src={`/api/files?key=${encodeURIComponent(video.thumbnailKey)}`} alt="Video thumbnail" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">No preview</div>
                )}
                <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/70 text-xs text-white">
                  {video.metadata ? JSON.parse(video.metadata as string).duration?.toFixed(0) : '?'}s
                </div>
              </div>
              <div className="flex-1 space-y-4">
                <div>
                  <h3 className="font-semibold text-white">{video.originalFilename}</h3>
                  <p className="text-sm text-gray-400">{video.metadata ? JSON.parse(video.metadata as string).width : '?'}×{video.metadata ? JSON.parse(video.metadata as string).height : '?'}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="btn btn-ghost project-danger" onClick={() => handleDeleteVideo(video.id)} disabled={deleting?.startsWith('video-')}>
                    <TrashIcon />Remove video only
                  </button>
                </div>
              </div>
            </div>
          )}
        </Card>
      ) : (
        <Card className="p-12 text-center">
          <h3 className="text-white font-semibold mb-2">No video yet</h3>
          <p className="text-gray-400 text-sm mb-6">Upload a video to start generating clips.</p>
          <Link className="btn btn-primary" href="/app/projects/new">Upload video</Link>
        </Card>
      )}

      {video?.status === 'ready' && !video.proxyKey && <a className="btn btn-primary" href={'/api/captions/' + video.id + '?format=srt'}>Download SRT</a>}
      {/* Generated Clips */}
      {project.clips.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white">Generated Clips</h2>
            <Link className="btn btn-ghost" href={`/app/clips/${project.clips[0]?.id}`}>View all {project.clips.length} →</Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {project.clips.slice(0, 8).map((clip) => (
              <Link key={clip.id} href={`/app/clips/${clip.id}`}>
                <Card className="p-3 hover:border-primary/50 transition-colors">
                  <div className="aspect-video rounded-lg bg-surface2 mb-3 relative overflow-hidden">
                    {clip.thumbnailKey ? (
                      <img src={`/api/files?key=${encodeURIComponent(clip.thumbnailKey)}`} alt="Video thumbnail" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">No preview</div>
                    )}
                    <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/70 text-xs text-white">
                      {clip.duration.toFixed(0)}s
                    </div>
                  </div>
                  <h4 className="font-medium text-white text-sm truncate mb-1">{clip.title}</h4>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <StatusBadge status={clip.status} />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Processing indicator */}
      {video && !['ready', 'error'].includes(video.status) && (
        <Card className="p-6 border-primary/30">
          <div className="flex items-center gap-4">
            <Spinner className="text-primary" />
            <div>
              <p className="font-medium text-white">Processing video</p>
              <p className="text-sm text-gray-400">Transcribing and generating captions. Clips are generated separately. This usually takes a few minutes.</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ready: 'bg-success/20 text-success',
    processing: 'bg-warning/20 text-warning',
    error: 'bg-error/20 text-error',
    uploaded: 'bg-muted/20 text-muted',
    draft: 'bg-muted/20 text-muted',
    exporting: 'bg-primary/20 text-primary',
  };
  const labels: Record<string, string> = { ready: 'Captions ready', processing: 'Processing', error: 'Needs attention', uploaded: 'Uploaded', draft: 'Draft', exporting: 'Exporting' };
  return (
    <span className={`px-2 py-1 rounded-md text-xs font-medium ${colors[status] || colors.draft}`}>
      {labels[status] ?? status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function TrashIcon() {
  return <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16 M10 11v6 M14 11v6 M6 7l1 13h10l1-13 M9 7V4h6v3" /></svg>;
}
