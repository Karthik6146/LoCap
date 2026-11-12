import { prisma } from '@clipx/database';
import { getCurrentUser } from '@/lib/session';
import { captionDocument, captionRevision } from '@/lib/captions';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import CaptionEditor from './editor';

const steps = ['Review', 'Style', 'Preview', 'Export'];

export default async function CaptionsPage({ params }: { params: { videoId: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect('/app');
  const video = await prisma.video.findFirst({
    where: { id: params.videoId, project: { userId: user.id } },
    include: { captions: { where: { clipId: null }, orderBy: { order: 'asc' } }, transcript: { include: { words: { orderBy: { index: 'asc' }, select: { text: true, start: true, end: true } } } } },
  });
  if (!video) notFound();
  const meta = JSON.parse(video.metadata ?? '{}');
  const provider = JSON.parse(video.transcript?.data ?? '{}');
  return <div className="space-y-5">
    <div>
      <ol className="studio-kicker flex flex-wrap gap-2" aria-label="Caption steps">{steps.map((s, i) => <li key={s} aria-current={i === 0 ? 'step' : undefined} className={i === 0 ? 'text-gray-100' : undefined}>{i > 0 && <span aria-hidden="true" className="mr-2">·</span>}{s}</li>)}</ol>
      <div className="mt-2 mb-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-display font-medium">Caption studio</h1>
        <Link className="btn btn-secondary" href={'/app/projects/' + video.projectId}><ArrowLeft size={16} strokeWidth={1.5} aria-hidden="true" />Back to project</Link>
      </div>
      <p className="text-gray-400 break-all">{video.originalFilename}</p>
    </div>
    {provider.demo && <p role="status" className="card p-4 text-yellow-300">These are old sample captions. On the project page, choose “Generate captions from audio” to replace them with speech from your video.</p>}
    {provider.diagnostics && <p className="text-sm text-gray-300">Captions were created from your audio. {provider.diagnostics.fallbackWords > 0 ? `${provider.diagnostics.fallbackWords} words have estimated timing, so check them before exporting.` : 'Check spelling and names before exporting.'}</p>}
    {provider.conversion && <details className="text-sm text-gray-400"><summary className="cursor-pointer">Processing details</summary><p className="pb-2">Speech recognition: {provider.diagnostics?.model ?? provider.provider} · Hinglish conversion: {provider.conversion.model ?? provider.conversion.provider} · {provider.diagnostics?.alignment === 'whisperx' ? 'Word timing aligned to speech' : 'Automatic word timing'}</p></details>}
    {video.status === 'error' && <p role="alert" className="text-red-300">{video.error} Retry processing from the project page, or add captions below.</p>}
    <CaptionEditor audioKey={video.audioKey ?? undefined} sourceWords={video.transcript?.words ?? []} videoId={video.id} sourceKey={video.sourceKey} duration={meta.duration ?? 0} width={meta.width ?? 1920} height={meta.height ?? 1080} initial={captionDocument(video.captions)} initialRevision={captionRevision(video.captions)} />
  </div>;
}
