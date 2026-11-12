'use client';

import { useState, useEffect } from 'react';
import { Spinner } from '@/components/ui';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, Download, Film } from 'lucide-react';

interface Clip {
  id: string;
  title: string;
  duration: number;
  aspect: string;
  status: string;
  proxyKey: string | null;
  projectId: string;
  video?: {
    id: string;
    originalFilename: string;
    proxyKey: string | null;
  } | null;
}

export default function ClipPage({ params }: { params: { id: string } }) {
  const [clip, setClip] = useState<Clip | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/clips/${params.id}`)
      .then((res) => {
        if (!res.ok) throw new Error('Not found');
        return res.json();
      })
      .then((data: Clip) => {
        setClip(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="text-primary" />
      </div>
    );
  }

  if (!clip) {
    return (
      <div className="workspace-empty">
        <AlertCircle size={24} strokeWidth={1.5} aria-hidden="true" className="mx-auto mb-4 text-gray-500" />
        <h3 className="text-gray-100 mb-6">Clip not found</h3>
        <Link className="btn btn-secondary" href="/app/projects">Back to projects</Link>
      </div>
    );
  }

  // Clips in the MVP render from the full captioned video until per-clip exports exist.
  const proxyKey = clip.proxyKey ?? clip.video?.proxyKey ?? null;
  const videoUrl = proxyKey ? `/api/files?key=${encodeURIComponent(proxyKey)}` : null;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight text-gray-100">{clip.title}</h1>
          <p className="text-sm text-gray-500 mt-1 tabular">
            {clip.duration.toFixed(1)}s · {clip.aspect}
          </p>
        </div>
        <Link className="btn btn-text shrink-0" href={`/app/projects/${clip.projectId}`}>
          <ArrowLeft size={16} strokeWidth={1.5} aria-hidden="true" />
          Back to project
        </Link>
      </div>

      {videoUrl ? (
        <div className="space-y-4">
          <div className="aspect-[9/16] max-h-[70vh] rounded-2xl bg-black overflow-hidden mx-auto">
            <video
              src={videoUrl}
              controls
              playsInline
              className="w-full h-full object-contain"
            />
          </div>
          <div className="flex gap-3">
            <a className="btn btn-primary" href={videoUrl} download target="_blank" rel="noreferrer">
              <Download size={16} strokeWidth={1.5} aria-hidden="true" />
              Download captioned video
            </a>
            <Link className="btn btn-secondary" href="/app/projects">All projects</Link>
          </div>
          <p className="text-xs text-gray-500">
            New clips export their own captioned render; MVP clips play the full captioned video.
          </p>
        </div>
      ) : (
        <div className="workspace-empty">
          <Film size={24} strokeWidth={1.5} aria-hidden="true" className="mx-auto mb-4 text-gray-500" />
          <h3 className="text-gray-100">No video yet</h3>
          <p>This clip has no rendered output yet</p>
          <Link className="btn btn-primary" href="/app/projects">Back to projects</Link>
        </div>
      )}
    </div>
  );
}