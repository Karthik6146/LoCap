'use client';

import { useState, useRef, useEffect } from 'react';
import { GenerationSettings } from '@/components/generation-options';
import type { GenerationOptions } from '@clipx/types';
import { useRouter } from 'next/navigation';
import { Button, Input, Card, CardContent, Spinner } from '@/components/ui';

export default function NewProjectPage() {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; clearTimeout(timer.current); }; }, []);
  const [step, setStep] = useState<'name' | 'upload' | 'processing'>('name');
  const [settings, setSettings] = useState<GenerationOptions>({ outputLanguage: 'hinglish', templateId: 'gold' });
  const [jobMessage, setJobMessage] = useState('');
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);

  function onDrag(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  function handleFile(f: File) {
    const ext = f.name.split('.').pop()?.toLowerCase();
    if (!['mp4', 'mov', 'webm', 'mkv'].includes(ext ?? '')) {
      setError('Unsupported format. Use MP4, MOV, WEBM, or MKV.');
      return;
    }
    if (f.size > 2 * 1024 * 1024 * 1024) {
      setError('File too large (max 2 GB).');
      return;
    }
    setFile(f);
    setError('');
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setProgress(0);
    setError('');

    try {
      // Upload the video — the upload endpoint creates the project + video and
      // enqueues the pipeline, returning all of them. We don't pre-create a
      // project (that used to leave an empty orphan project and 404 on process).
      const form = new FormData();
      form.append('file', file);
      form.append('outputLanguage', settings.outputLanguage);
      form.append('templateId', settings.templateId);
      form.append('outputMode', settings.outputMode ?? 'video');
      if (settings.vocabulary?.length) form.append('vocabulary', JSON.stringify(settings.vocabulary));
      form.append('name', name.trim() || file.name.replace(/\.[^.]+$/, ''));
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: form });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error);

      setProjectId(uploadData.project.id);

      setStep('processing');
      pollJob(uploadData.jobId, uploadData.video.id);
    } catch (err: any) {
      setError(err.message);
      setUploading(false);
    }
  }

  async function pollJob(jobId: string, videoId: string) {
    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      const data = await res.json();
      if (!alive.current) return;
      if (!res.ok) throw new Error(data.error || 'Could not check processing');
      setProgress(data.progress ?? 0);
      setJobMessage(data.message ?? 'Processing');
      if (data.status === 'completed') {
        router.push(`/app/captions/${videoId}`);
      } else if (data.status === 'failed') {
        setError(data.error || 'Processing failed.');
        setUploading(false);
      } else {
        timer.current = setTimeout(() => pollJob(jobId, videoId), 2000);
      }
    } catch {
      if (!alive.current) return;
      setError('Could not check processing. Open the project to check its status.');
      setUploading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Step indicator */}
      <ol className="flex items-center justify-center gap-3 text-sm" aria-label="Progress">
        {['Name', 'Upload', 'Processing'].map((s, i) => {
          const current = ['name', 'upload', 'processing'].indexOf(step);
          return (
          <li key={s} className="flex items-center gap-2" aria-current={i === current ? 'step' : undefined}>
            <span
              aria-hidden="true"
              className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                i === current ? 'bg-primary text-[#03241b]' : i < current ? 'bg-primary/20 text-primary' : 'bg-surface2 text-gray-400'
              }`}
            >
              {i < current ? '✓' : i + 1}
            </span>
            <span className={i === current ? 'text-white font-medium' : 'text-gray-400'}>{s}<span className="sr-only">{i < current ? ' (done)' : ''}</span></span>
            {i < 2 && <span aria-hidden="true" className="h-0.5 w-8 sm:w-12 bg-border" />}
          </li>
        ); })}
      </ol>

      {step === 'name' && (
        <Card>
          <CardContent>
           <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); if (name.trim()) setStep('upload'); }}>
            <div className="text-center">
              <h1 className="font-display text-2xl font-bold text-white">New Project</h1>
              <p className="text-gray-400">Give your project a name, then upload a video.</p>
            </div>
            <div>
              <label htmlFor="name" className="label">Project Name</label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My next story"
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full" disabled={!name.trim()}>
              Continue
            </Button>
            <p className="text-sm text-gray-400 text-center">Next you&apos;ll upload a video (MP4, MOV, WEBM or MKV, up to 2 GB). Captions are generated automatically.</p>
           </form>
          </CardContent>
        </Card>
      )}

      {step === 'upload' && (
        <Card>
          <CardContent className="space-y-6">
            <div className="text-center">
              <h1 className="font-display text-2xl font-bold text-white">Upload Video</h1>
              <p className="text-gray-400">Drag & drop or click to select. MP4, MOV, WEBM, MKV — up to 2 GB.</p>
            </div>

            <div
              className={`border-2 border-dashed rounded-2xl p-8 text-center transition-colors ${
                dragActive ? 'border-primary bg-primary/5' : 'border-border'
              }`}
              onDragEnter={onDrag}
              onDragLeave={onDrag}
              onDragOver={onDrag}
              onDrop={onDrop}
            >
              <input
                type="file"
                id="file-input"
                accept="video/mp4,video/quicktime,video/webm,video/x-matroska"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                className="block w-full mb-4"
              />
              <label htmlFor="file-input" className="cursor-pointer">
                {file ? (
                  <div className="space-y-2">
                    <div className="text-5xl">🎬</div>
                    <p className="font-medium text-white">{file.name}</p>
                    <p className="text-sm text-gray-400">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                    <Button variant="ghost" size="sm" onClick={() => setFile(null)}>
                      Remove
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="text-5xl mb-2">📁</div>
                    <p className="text-white font-medium">Drop video here or click to browse</p>
                    <p className="text-sm text-gray-500 mt-1">MP4, MOV, WEBM, MKV • Max 2 GB</p>
                  </>
                )}
              </label>
            </div>

            {error && <div className="p-3 rounded-lg bg-error/10 border border-error/30 text-error text-sm">{error}</div>}

            <GenerationSettings value={settings} onChange={setSettings} />
            <p className="text-xs text-gray-400">Transcribed locally from your audio. Review names and spellings before exporting.</p>
            <Button className="w-full" onClick={handleUpload} disabled={!file || uploading} loading={uploading}>
              {uploading ? 'Uploading…' : 'Generate captions'}
            </Button>

            {uploading && (
              <div className="space-y-2">
                <div className="h-2 bg-surface2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-sm text-gray-500 text-center">{progress}%</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === 'processing' && (
        <Card>
          <CardContent className="space-y-6 text-center">
            <Spinner size="lg" className="mx-auto text-primary" />
            <h2 className="font-display text-xl font-bold text-white">Processing your video</h2>
            <p className="text-gray-400">This usually takes a few minutes. We'll redirect you when it's done.</p>
            <div className="h-2 bg-surface2 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p role="status" className="text-sm text-gray-300">{progress}% - {jobMessage}</p>
            {error && <div role="alert" className="text-red-300">{error}<a className="btn btn-ghost" href={"/app/projects/" + projectId}>Open project to retry</a></div>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
