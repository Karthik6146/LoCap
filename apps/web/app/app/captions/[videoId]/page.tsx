import { prisma } from '@clipx/database';
import { getCurrentUser } from '@/lib/session';
import { captionDocument, captionRevision } from '@/lib/captions';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import CaptionEditor from './editor';

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
  return <div className="mx-auto max-w-[1720px] space-y-5">
    <div className="flex flex-wrap justify-between gap-3">
      <div><p className="studio-kicker">Review → Style → Preview → Export</p><h1 className="text-3xl font-display font-bold mt-2 mb-1">Caption studio</h1><p className="text-gray-400 break-all">{video.originalFilename}</p></div>
      <Link className="btn btn-ghost" href={'/app/projects/' + video.projectId}>Back to project</Link>
    </div>
    {provider.demo && <p role="status" className="card p-4 text-yellow-300">These are old sample captions. On the project page, choose “Generate captions from audio” to replace them with speech from your video.</p>}
    {provider.diagnostics && <p className="text-sm text-gray-300">Captions were created from your audio. {provider.diagnostics.fallbackWords > 0 ? `${provider.diagnostics.fallbackWords} words have estimated timing, so check them before exporting.` : 'Check spelling and names before exporting.'}</p>}
    {provider.conversion && <details className="text-sm text-gray-400"><summary className="cursor-pointer">Processing details</summary><p className="pb-2">Speech recognition: {provider.diagnostics?.model ?? provider.provider} · Hinglish conversion: {provider.conversion.model ?? provider.conversion.provider} · {provider.diagnostics?.alignment === 'whisperx' ? 'Word timing aligned to speech' : 'Automatic word timing'}</p></details>}
    {video.status === 'error' && <p role="alert" className="text-red-300">{video.error} Retry processing from the project page, or add captions below.</p>}
    <CaptionEditor audioKey={video.audioKey ?? undefined} sourceWords={video.transcript?.words ?? []} videoId={video.id} sourceKey={video.sourceKey} duration={meta.duration ?? 0} width={meta.width ?? 1920} height={meta.height ?? 1080} initial={captionDocument(video.captions)} initialRevision={captionRevision(video.captions)} />
  </div>;
}
