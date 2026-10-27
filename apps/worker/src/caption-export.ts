import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Env } from '@clipx/types';
import type { Storage } from '@clipx/storage';
import { captionsToBurnGroups, validateDocument } from '@clipx/captions';
import { burnCaptions, probeVideo } from '@clipx/video-engine';
import { setJob, type Db } from './progress.js';

export async function processCaptionExport(db: Db, env: Env, storage: Storage, job: { id: string; userId: string; videoId: string; projectId: string; input?: unknown }) {
  const ws = await mkdtemp(path.join(tmpdir(), 'clipx-export-'));
  let exportId: string | undefined;
  try {
    const input = (typeof job.input === 'string' ? JSON.parse(job.input) : job.input) as { document: unknown; exportId: string };
    if (!input || typeof input.exportId !== 'string') throw new Error('Invalid caption export job');
    exportId = input.exportId;
    const where = { id: exportId, userId: job.userId, projectId: job.projectId };
    const video = await db.video.findFirstOrThrow({ where: { id: job.videoId, projectId: job.projectId, project: { userId: job.userId } } });
    if (!video.sourceKey.startsWith(`users/${job.userId}/`)) throw new Error('Source ownership mismatch');
    const source = await storage.resolveLocal(video.sourceKey);
    const meta = await probeVideo(env, source);
    validateDocument(input.document, meta.duration);
    if (!input.document.captions.length) throw new Error('No captions to export');
    await db.export.updateMany({ where, data: { status: 'rendering', progress: 10, error: null } });
    await setJob(db, job.id, { status: 'rendering', progress: 10, message: 'Rendering saved captions at source resolution' });
    const output = path.join(ws, 'captioned.mp4');
    await burnCaptions(env, source, output, { groups: captionsToBurnGroups(input.document.captions), style: input.document.style, width: meta.width, height: meta.height });
    await setJob(db, job.id, { status: 'uploading', progress: 95, message: 'Saving captioned video' });
    const key = `users/${job.userId}/projects/${job.projectId}/exports/${job.id}.mp4`;
    await storage.put(key, await readFile(output), { contentType: 'video/mp4' });
    await db.export.updateMany({ where, data: { status: 'ready', outputKey: key, progress: 100, completedAt: new Date() } });
    await setJob(db, job.id, { status: 'completed', progress: 100, outputKey: key, message: 'Captioned video ready' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Caption export failed';
    if (exportId) await db.export.updateMany({ where: { id: exportId, userId: job.userId, projectId: job.projectId }, data: { status: 'failed', error: message } });
    await setJob(db, job.id, { status: 'failed', error: message, message });
    throw err;
  } finally { await rm(ws, { recursive: true, force: true }); }
}
