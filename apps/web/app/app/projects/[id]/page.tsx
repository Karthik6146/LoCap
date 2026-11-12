'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui';
import Link from 'next/link';
import { ArrowRight, Loader2, Plus, Trash2 } from 'lucide-react';
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
      <div role="status" className="flex items-center justify-center h-64 text-gray-500">
        <Loader2 size={16} strokeWidth={1.5} aria-hidden="true" className="motion-safe:animate-spin" />
        <span className="sr-only">Loading project</span>
      </div>
    );
  }

  if (!project) return null;

  const video = project.videos[0];
  const clipCount = project.clips.length;
  const meta = video?.metadata ? JSON.parse(video.metadata as string) : null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-medium tracking-tight text-gray-100 break-words">{project.name}</h1>
          <p className="text-gray-400 text-sm mt-1 tabular-nums">
            {video?.status === 'ready'
              ? clipCount > 0
                ? `Captions ready · ${clipCount} clips generated`
                : 'Captions ready · Generate clips when you’re ready'
              : video && !['ready', 'error'].includes(video.status)
              ? 'Processing captions…'
              : video?.status === 'error' ? 'Processing failed – retry or edit captions' : 'Waiting for upload'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {video?.status === 'ready' && clipCount === 0 && (
            <button className="btn-secondary" onClick={handleGenerateClips} disabled={generating}>
              {generating ? 'Generating…' : 'Generate clips'}
            </button>
          )}
          {video?.status === 'ready' && clipCount > 0 && (
            <Link className="btn-secondary" href={`/app/clips/${project.clips[0]?.id}`}>View clips</Link>
          )}
          <Link className="btn-secondary" href="/app/projects/new">
            <Plus size={16} strokeWidth={1.5} aria-hidden="true" />New project
          </Link>
          <button className="btn-secondary project-danger" onClick={handleDeleteProject} disabled={deleting === 'project'}>
            <Trash2 size={16} strokeWidth={1.5} aria-hidden="true" />{deleting === 'project' ? 'Deleting…' : 'Delete project'}
          </button>
        </div>
      </div>

      {video && <div className="card p-4 flex flex-wrap items-center gap-3">
        <Link className="btn-primary" href={'/app/captions/' + video.id}>Review & edit captions</Link>
        <StatusBadge status={video.status} />
        {['error', 'ready'].includes(video.status) && <details className="w-full"><summary className="cursor-pointer py-3 text-sm font-medium text-gray-100">Generate captions from audio</summary><fieldset disabled={processing} className="space-y-5 pt-3 max-w-3xl"><GenerationSettings value={settings} onChange={setSettings} /><button className="btn-secondary" disabled={processing} onClick={() => retry(video.id)}>{processing ? 'Generating captions…' : 'Generate selected captions'}</button></fieldset></details>}
        {processing && <p role="status" className="text-sm text-gray-400 tabular-nums">{jobMessage}</p>}
        {(error || video.error) && <p role="alert" className="text-sm text-red-300">{error || video.error}</p>}
        <p className="text-sm text-gray-500">The preview below is the initial generation. Export your latest edits from Caption studio.</p>
      </div>}
      {/* Video status */}
      {video ? (
        video.status === 'ready' && video.proxyKey ? (
          <Card className="w-fit max-w-full p-4 space-y-4">
            <video
              key={video.proxyKey}
              src={`/api/files?key=${encodeURIComponent(video.proxyKey)}`}
              controls
              playsInline
              className="project-video-preview rounded-xl bg-black object-contain"
            />
            {/* w-0 min-w-full: footer takes the video's width instead of widening the card */}
            <div className="w-0 min-w-full flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1 basis-40">
                <p className="truncate text-sm text-gray-500" title={video.originalFilename}>{video.originalFilename}</p>
                <p className="text-sm text-gray-400 tabular-nums">
                  Captioned video · {meta ? `${meta.width}×${meta.height}` : '1080×1920'}
                </p>
              </div>
              <Link className="btn-secondary" href={`/app/captions/${video.id}#caption-position`}>Adjust caption position</Link>
              <button className="btn-secondary project-danger" onClick={() => handleDeleteVideo(video.id)} disabled={deleting?.startsWith('video-')}>
                <Trash2 size={16} strokeWidth={1.5} aria-hidden="true" />Remove video only
              </button>
            </div>
          </Card>
        ) : (
          <Card className="p-5">
            <div className="flex flex-col lg:flex-row gap-5">
              <div className="w-full lg:w-64 aspect-video rounded-xl bg-surface2 relative overflow-hidden flex-shrink-0">
                {video.thumbnailKey ? (
                  <img src={`/api/files?key=${encodeURIComponent(video.thumbnailKey)}`} alt="Video thumbnail" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">No preview</div>
                )}
                <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/70 text-xs text-gray-100 tabular-nums">
                  {meta ? meta.duration?.toFixed(0) : '?'}s
                </div>
              </div>
              <div className="flex-1 min-w-0 space-y-4">
                <div>
                  <p className="truncate text-sm text-gray-500" title={video.originalFilename}>{video.originalFilename}</p>
                  <p className="text-sm text-gray-400 tabular-nums">{meta ? meta.width : '?'}×{meta ? meta.height : '?'}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="btn-secondary project-danger" onClick={() => handleDeleteVideo(video.id)} disabled={deleting?.startsWith('video-')}>
                    <Trash2 size={16} strokeWidth={1.5} aria-hidden="true" />Remove video only
                  </button>
                </div>
              </div>
            </div>
          </Card>
        )
      ) : (
        <div className="workspace-empty">
          <h3>No video yet</h3>
          <p>Upload a video to start generating clips</p>
          <Link className="btn-primary" href="/app/projects/new">Upload video</Link>
        </div>
      )}

      {video?.status === 'ready' && !video.proxyKey && <a className="btn-secondary" href={'/api/captions/' + video.id + '?format=srt'}>Download SRT</a>}
      {/* Generated Clips */}
      {clipCount > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-medium text-gray-100">Generated clips</h2>
            <Link className="btn-text" href={`/app/clips/${project.clips[0]?.id}`}>
              View all <span className="tabular-nums">{clipCount}</span>
              <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {project.clips.slice(0, 8).map((clip) => (
              <Link key={clip.id} href={`/app/clips/${clip.id}`}>
                <Card className="p-4 hover:border-gray-700 transition-colors">
                  <div className="aspect-video rounded-xl bg-surface2 mb-3 relative overflow-hidden">
                    {clip.thumbnailKey ? (
                      <img src={`/api/files?key=${encodeURIComponent(clip.thumbnailKey)}`} alt="Video thumbnail" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">No preview</div>
                    )}
                    <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/70 text-xs text-gray-100 tabular-nums">
                      {clip.duration.toFixed(0)}s
                    </div>
                  </div>
                  <h4 className="font-medium text-gray-100 text-sm truncate mb-1">{clip.title}</h4>
                  <StatusBadge status={clip.status} />
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Processing indicator */}
      {video && !['ready', 'error'].includes(video.status) && (
        <Card className="p-5">
          <div className="flex items-center gap-4">
            <Loader2 size={16} strokeWidth={1.5} aria-hidden="true" className="shrink-0 text-gray-400 motion-safe:animate-spin" />
            <div>
              <p className="font-medium text-gray-100">Processing video</p>
              <p className="text-sm text-gray-400">Transcribing and generating captions. Clips are generated separately. This usually takes a few minutes.</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

// Neutral label; color lives only in the status dot.
function StatusBadge({ status }: { status: string }) {
  const dots: Record<string, string> = {
    ready: 'bg-success',
    processing: 'bg-warning',
    error: 'bg-error',
    uploaded: 'bg-gray-500',
    draft: 'bg-gray-500',
    exporting: 'bg-gray-400',
  };
  const labels: Record<string, string> = { ready: 'Captions ready', processing: 'Processing', error: 'Needs attention', uploaded: 'Uploaded', draft: 'Draft', exporting: 'Exporting' };
  return (
    <span className="inline-flex items-center gap-2 text-xs font-medium text-gray-400">
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${dots[status] || dots.draft}`} />
      {labels[status] ?? status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
