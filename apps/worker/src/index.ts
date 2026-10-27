/**
 * LoCap worker entrypoint — consumes RenderJobs and runs the real FFmpeg/AI
 * pipeline. Uses a DB-polling queue (works with zero external services).
 */

import { prisma } from '@clipx/database';
import { loadEnv } from '@clipx/types';
import { getStorage } from '@clipx/storage';
import { processPipelineJob, processRenderJob, processAnalyzeJob } from './pipeline.js';
import { assertBundledFonts } from '@clipx/video-engine';
import { processCaptionExport } from './caption-export.js';

const env = loadEnv();
const storage = await getStorage(env);

const POLL_MS = 2_000;
let running = true;

async function claimNext() {
  return prisma.$transaction(async (tx) => {
    const candidate = await tx.renderJob.findFirst({
      where: { status: 'queued' },
      orderBy: { createdAt: 'asc' },
    });
    if (!candidate) return null;
    const claim = candidate.type === 'render' ? 'cutting' : candidate.type === 'analyze' ? 'analyzing' : 'probing';
    return tx.renderJob.update({
      where: { id: candidate.id },
      data: { status: claim, message: 'Starting…' },
    });
  });
}

async function runJob(job: { id: string; type: string; projectId: string; videoId: string; userId: string; clipId?: string | null; input?: unknown }) {
  const t0 = Date.now();
  try {
    if (job.type === 'caption') {
      await processCaptionExport(prisma, env, storage, job);
    } else if (job.type === 'render') {
      await processRenderJob(prisma, env, storage, job);
    } else if (job.type === 'analyze') {
      await processAnalyzeJob(prisma, env, storage, job);
    } else {
      await processPipelineJob(prisma, env, storage, job);
    }
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`[worker] ${job.id} done in ${secs}s`);
  } catch (err) {
    console.error(`[worker] ${job.id} failed:`, err instanceof Error ? err.message : err);
  }
}

async function tick() {
  if (!running) return;
  try {
    const job = await claimNext();
    if (job) {
      // Fire-and-forget but await before next claim to process serially.
      await runJob(job);
    }
  } catch (err) {
    console.error('[worker] tick error:', err);
  }
}

async function main() {
  console.log(`[worker] starting (storage=${storage.kind}, transcription=${env.localTranscription ? 'local-whisper' : env.transcription?.apiKey ? 'api' : 'not configured'}, alignment=${env.localTranscription?.alignment ?? 'provider'})`);
  await assertBundledFonts().catch((err) => { console.error('[worker]', err instanceof Error ? err.message : err); process.exit(1); });
  // eslint-disable-next-line no-constant-condition
  while (running) {
    await tick();
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

process.on('SIGINT', () => { running = false; shutdown('SIGINT'); });
process.on('SIGTERM', () => { running = false; shutdown('SIGTERM'); });

let shuttingDown = false;
function shutdown(sig: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[worker] ${sig} received, shutting down`);
  setTimeout(() => process.exit(0), 500).unref();
}

main().catch((err) => {
  console.error('[worker] fatal:', err);
  process.exit(1);
});
