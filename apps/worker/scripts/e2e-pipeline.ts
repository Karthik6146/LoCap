/**
 * End-to-end headless validation of the pipeline job:
 *   DB → upload test video → enqueue RenderJob → processPipelineJob →
 *   assert transcript + words + draft clips + ready status.
 *
 * Run: DATABASE_URL="file:.../test.db" npx tsx apps/worker/scripts/e2e-pipeline.ts
 */

import { execSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const workerDir = join(here, '..');
const pkgDb = join(here, '..', '..', '..', 'packages', 'database');

async function main() {
  const dir = await mkdtemp(join(tmpdir(), 'clipx-e2e-'));
  const dbPath = join(dir, 'test.db');
  process.env.DATABASE_URL = `file:${dbPath}`;
  process.env.NODE_ENV = 'test';
  process.env.S3_ENDPOINT = 'http://127.0.0.1:9'; // unreachable → LocalStorage

  execSync(`npx prisma migrate deploy --schema "${join(pkgDb, 'prisma', 'schema.prisma')}"`, {
    cwd: workerDir,
    env: { ...process.env, DATABASE_URL: `file:${dbPath}` },
    stdio: 'inherit',
  });

  const { prisma } = await import('@clipx/database');
  const { loadEnv } = await import('@clipx/types');
  const { LocalStorage } = await import('@clipx/storage');
  const { generateTestVideo } = await import('@clipx/video-engine');
  const { processPipelineJob } = await import('../src/pipeline.js');

  const env = loadEnv();
  const storage = new LocalStorage(join(dir, 'storage'));

  // Seed a user/project/video.
  const user = await prisma.user.create({ data: { email: 'e2e@clipx.app', name: 'E2E' } });
  const project = await prisma.project.create({ data: { userId: user.id, name: 'E2E Project' } });
  const video = await prisma.video.create({
    data: {
      projectId: project.id,
      originalFilename: 'source.mp4',
      sourceKey: `users/${user.id}/projects/${project.id}/source/source.mp4`,
      status: 'uploaded',
    },
  });

  // Upload a real generated test video to local storage.
  const srcLocal = join(dir, 'source.mp4');
  await generateTestVideo(env, { outFile: srcLocal, duration: 12 });
  const srcBuf = await (await import('node:fs/promises')).readFile(srcLocal);
  await storage.put(video.sourceKey, srcBuf);

  // Enqueue a pipeline job and process it.
  const job = await prisma.renderJob.create({
    data: {
      projectId: project.id,
      userId: user.id,
      videoId: video.id,
      type: 'pipeline',
      status: 'queued',
    },
  });
  await processPipelineJob(prisma, env, storage, job);

  // Assertions.
  const t = await prisma.transcript.findUnique({ where: { videoId: video.id }, include: { words: true } });
  if (!t) throw new Error('FAIL: transcript not created');
  if (t.words.length < 5) throw new Error(`FAIL: expected words, got ${t.words.length}`);
  const clips = await prisma.clip.findMany({ where: { videoId: video.id } });
  if (clips.length === 0) throw new Error('FAIL: no draft clips created');
  const v = await prisma.video.findUnique({ where: { id: video.id } });
  if (v?.status !== 'ready') throw new Error(`FAIL: video status ${v?.status}`);
  const done = await prisma.renderJob.findUnique({ where: { id: job.id } });
  if (done?.status !== 'completed') throw new Error(`FAIL: job status ${done?.status}`);

  console.log(`PASS: transcript words=${t.words.length}, clips=${clips.length}, video=${v?.status}, job=${done?.status}`);
  console.log(`  sample: "${t.words.slice(0, 5).map((w) => w.text).join(' ')}"`);

  await prisma.$disconnect();
  await rm(dir, { recursive: true, force: true });
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
