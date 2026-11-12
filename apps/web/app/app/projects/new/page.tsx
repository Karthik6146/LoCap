'use client';

import { useState, useRef, useEffect } from 'react';
import { GenerationSettings } from '@/components/generation-options';
import type { GenerationOptions } from '@clipx/types';
import { useRouter } from 'next/navigation';
import { Button, Input, Card } from '@/components/ui';
import { Check, FileVideo, Loader2, Upload } from 'lucide-react';

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

  const bar = (label: string) => (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progress}
      className="h-2 bg-surface2 rounded-full overflow-hidden"
    >
      <div
        className="h-full w-full origin-left bg-primary transition-transform duration-300 motion-reduce:transition-none"
        style={{ transform: `scaleX(${progress / 100})` }}
      />
    </div>
  );

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
              className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium tabular-nums ${
                i === current ? 'bg-primary text-bg' : i < current ? 'bg-surface2 text-gray-100' : 'bg-surface2 text-gray-500'
              }`}
            >
              {i < current ? <Check size={16} strokeWidth={1.5} aria-hidden="true" /> : i + 1}
            </span>
            <span className={i === current ? 'text-gray-100 font-medium' : 'text-gray-400'}>{s}<span className="sr-only">{i < current ? ' (done)' : ''}</span></span>
            {i < 2 && <span aria-hidden="true" className="h-px w-8 sm:w-12 bg-border" />}
          </li>
        ); })}
      </ol>

      {step === 'name' && (
        <Card className="p-5">
           <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); if (name.trim()) setStep('upload'); }}>
            <div className="text-center">
              <h1 className="font-display text-3xl font-medium tracking-tight text-gray-100">New project</h1>
              <p className="text-gray-400 mt-2">Give your project a name, then upload a video</p>
            </div>
            <div>
              <label htmlFor="name" className="label">Project name</label>
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
            <p className="text-sm text-gray-500 text-center">Next you&apos;ll upload a video (MP4, MOV, WEBM or MKV, up to 2 GB). Captions are generated automatically.</p>
           </form>
        </Card>
      )}

      {step === 'upload' && (
        <Card className="p-5 space-y-6">
            <div className="text-center">
              <h1 className="font-display text-3xl font-medium tracking-tight text-gray-100">Upload video</h1>
              <p className="text-gray-400 mt-2">Drag and drop or click to select. MP4, MOV, WEBM or MKV, up to 2 GB.</p>
            </div>

            <div
              className={`border border-dashed rounded-2xl px-5 py-8 text-center transition-colors ${
                dragActive ? 'border-gray-500 bg-surface2' : 'border-gray-700'
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
                    <FileVideo size={16} strokeWidth={1.5} aria-hidden="true" className="mx-auto text-gray-400" />
                    <p className="font-medium text-gray-100 truncate" title={file.name}>{file.name}</p>
                    <p className="text-sm text-gray-400 tabular-nums">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                    <Button variant="text" size="sm" onClick={() => setFile(null)}>
                      Remove
                    </Button>
                  </div>
                ) : (
                  <>
                    <Upload size={16} strokeWidth={1.5} aria-hidden="true" className="mx-auto mb-3 text-gray-400" />
                    <p className="text-gray-100 font-medium">Drop video here or click to browse</p>
                    <p className="text-sm text-gray-500 mt-1">MP4, MOV, WEBM, MKV · Max 2 GB</p>
                  </>
                )}
              </label>
            </div>

            {error && <div role="alert" className="p-4 rounded-xl bg-error/10 border border-error/30 text-red-300 text-sm">{error}</div>}

            <GenerationSettings value={settings} onChange={setSettings} />
            <p className="text-xs text-gray-500">Transcribed locally from your audio. Review names and spellings before exporting.</p>
            <Button className="w-full" onClick={handleUpload} disabled={!file || uploading} loading={uploading}>
              {uploading ? 'Uploading…' : 'Generate captions'}
            </Button>

            {uploading && (
              <div className="space-y-2">
                {bar('Upload progress')}
                <p className="text-sm text-gray-500 text-center tabular-nums">{progress}%</p>
              </div>
            )}
        </Card>
      )}

      {step === 'processing' && (
        <Card className="p-5 space-y-6 text-center">
            <div>
              <h2 className="font-display text-3xl font-medium tracking-tight text-gray-100">Processing your video</h2>
              <p className="text-gray-400 mt-2">This usually takes a few minutes. We&apos;ll redirect you when it&apos;s done.</p>
            </div>
            {bar('Processing progress')}
            <p role="status" className="flex items-center justify-center gap-2 text-sm text-gray-400 tabular-nums">
              {!error && <Loader2 size={16} strokeWidth={1.5} aria-hidden="true" className="shrink-0 motion-safe:animate-spin" />}
              {progress}% · {jobMessage}
            </p>
            {error && <div role="alert" className="space-y-4 text-sm text-red-300"><p>{error}</p><a className="btn-secondary" href={"/app/projects/" + projectId}>Open project to retry</a></div>}
        </Card>
      )}
    </div>
  );
}
