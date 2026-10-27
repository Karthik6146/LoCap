'use client';

import { useState, useEffect } from 'react';
import { Spinner, Card } from '@/components/ui';
import Link from 'next/link';

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
      <Card className="p-12 text-center space-y-4">
        <div className="text-5xl">😕</div>
        <h3 className="text-white font-semibold">Clip not found</h3>
        <Link className="btn btn-ghost" href="/app/projects">Back to projects</Link>
      </Card>
    );
  }

  // Clips in the MVP render from the full captioned video until per-clip exports exist.
  const proxyKey = clip.proxyKey ?? clip.video?.proxyKey ?? null;
  const videoUrl = proxyKey ? `/api/files?key=${encodeURIComponent(proxyKey)}` : null;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">{clip.title}</h1>
          <p className="text-sm text-gray-400 mt-1">
            {clip.duration.toFixed(1)}s • {clip.aspect}
          </p>
        </div>
        <Link className="btn btn-ghost" href={`/app/projects/${clip.projectId}`}>← Back to project</Link>
      </div>

      {videoUrl ? (
        <div className="space-y-4">
          <div className="aspect-[9/16] max-h-[70vh] rounded-xl bg-black overflow-hidden mx-auto">
            <video
              src={videoUrl}
              controls
              playsInline
              className="w-full h-full object-contain"
            />
          </div>
          <div className="flex gap-3">
            <a className="btn btn-primary" href={videoUrl} download target="_blank" rel="noreferrer">Download captioned video</a>
            <Link className="btn btn-ghost" href="/app/projects">All projects</Link>
          </div>
          <p className="text-xs text-gray-500">
            New clips export their own captioned render; MVP clips play the full captioned video.
          </p>
        </div>
      ) : (
        <Card className="p-12 text-center space-y-4">
          <div className="text-5xl">🎬</div>
          <h3 className="text-white font-semibold">No video yet</h3>
          <p className="text-gray-400 text-sm">This clip has no rendered output yet.</p>
          <Link className="btn btn-primary" href="/app/projects">Back to projects</Link>
        </Card>
      )}
    </div>
  );
}