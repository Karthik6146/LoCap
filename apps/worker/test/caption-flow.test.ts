import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { LocalStorage } from '@clipx/storage';
import { loadEnv, parseGenerationOptions } from '@clipx/types';
import { generateTestVideo, probeVideo, runFfmpeg } from '@clipx/video-engine';
import { replaceLine, retimeCaption } from '@clipx/captions';
import { processPipelineJob } from '../src/pipeline';
import { processCaptionExport } from '../src/caption-export';
import * as ai from '@clipx/ai';

const state = vi.hoisted(() => ({ userId: '', db: null as unknown, storage: null as unknown }));
vi.mock('@clipx/database', () => ({ get prisma() { return state.db; } }));
vi.mock('@/lib/session', () => ({ getCurrentUser: async () => ({ id: state.userId }) }));
vi.mock('@/lib/storage', () => ({ storage: async () => state.storage }));
import { POST as upload } from '../../web/app/api/upload/route';
import { POST as regenerate } from '../../web/app/api/projects/[id]/process/route';
import { GET as getProject } from '../../web/app/api/projects/[id]/route';
import { GET as getCaptions } from '../../web/app/api/captions/[videoId]/route';
import { PUT as edit } from '../../web/app/api/captions/[videoId]/edit/route';
import { POST as render } from '../../web/app/api/captions/[videoId]/render/route';
import { DELETE as deleteProject } from '../../web/app/api/projects/[id]/delete/route';
import { defaultStorageRoot } from '../../../packages/storage/src/local';
import { transcribeAudio } from '../src/transcribe-audio';

let dir: string;
let db: PrismaClient;
let store: LocalStorage;
let source: string;
const env = loadEnv({ ...process.env, NODE_ENV: 'test', TRANSCRIPTION_API_KEY: '', TRANSCRIPTION_PROVIDER: '' });
let videoId: string;
let jobId: string;
const ctx = () => ({ params: { videoId } });

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'clipx-regression-'));
  const url = 'file:' + path.join(dir, 'test.db').replace(/\\/g, '/');
  await writeFile(path.join(dir, 'test.db'), '');
  execFileSync(process.execPath, [path.resolve('../../node_modules/prisma/build/index.js'), 'db', 'push', '--schema', path.resolve('../../packages/database/prisma/schema.prisma'), '--skip-generate'], { env: { ...process.env, DATABASE_URL: url }, windowsHide: true });
  db = new PrismaClient({ datasources: { db: { url } } });
  store = new LocalStorage(path.join(dir, 'storage'));
  state.db = db; state.storage = store;
  state.userId = (await db.user.create({ data: { email: 'caption-test@example.invalid' } })).id;
  source = path.join(dir, 'source.mp4');
  await generateTestVideo(env, { outFile: source, duration: 3 });
});
afterAll(async () => { await db?.$disconnect(); if (dir) await rm(dir, { recursive: true, force: true }); });

describe.sequential('upload → worker → editor → downloads → captioned video', () => {
  it('validates and trims vocabulary at the generation boundary', () => {
    expect(parseGenerationOptions({ vocabulary: [' Minecraft ', '', 'Minecraft', 'search bar'] }).vocabulary).toEqual(['Minecraft', 'search bar']);
    for (const vocabulary of ['Minecraft', [123], Array(21).fill('word'), ['x'.repeat(81)], ['one two three four five six'], ['bad\nphrase'], ['\u06c1\u0644\u0648']]) {
      expect(() => parseGenerationOptions({ vocabulary })).toThrow('Use up to 20');
    }
  });
  it('delegates long local audio to VAD instead of cutting fixed windows', async () => {
    const transcribe = vi.fn(async () => ({ language: 'en' as const, script: 'en' as const, duration: 1800, confidence: 0, words: [], sentences: [], silences: [] }));
    await transcribeAudio(env, { name: 'local-whisper', transcribe }, 'original.wav', 1800, 'hi-latn', dir);
    expect(transcribe).toHaveBeenCalledTimes(1);
    expect(transcribe).toHaveBeenCalledWith('original.wav', { audioDuration: 1800, language: 'hi-latn' });
  });
  it('propagates language and template selections through upload and regeneration', async () => {
    const transcribe = vi.fn(async (_audio: string, _opts?: ai.TranscribeOptions): Promise<import('@clipx/types').Transcript> => ({ language: 'hi' as const, script: 'hi' as const, duration: 3, confidence: .9, words: [{ id: crypto.randomUUID(), text: 'आज', start: .2, end: 1, confidence: .9 }, { id: crypto.randomUUID(), text: 'game', start: 1.1, end: 2, confidence: .9 }], sentences: [], silences: [] }));
    const factory = vi.spyOn(ai, 'getTranscriptionProvider').mockReturnValue({ name: 'fixture', transcribe });
    try {
      const form = new FormData(); form.set('file', new File([new Uint8Array(await readFile(source))], 'language.mp4')); form.set('outputLanguage', 'hinglish'); form.set('templateId', 'mint');
      form.set('vocabulary', JSON.stringify(['Minecraft', 'search bar']));
      const result = await (await upload(new Request('http://test/upload', { method: 'POST', body: form }))).json();
      const job = await db.renderJob.findUniqueOrThrow({ where: { id: result.jobId } });
      await processPipelineJob(db, env, store, job);
      const thumbVideo = await db.video.findUniqueOrThrow({ where: { id: result.video.id } });
      expect(thumbVideo.thumbnailKey).toMatch(new RegExp('^users/' + state.userId + '/projects/' + result.project.id + '/'));
      const thumbnail = await readFile(await store.resolveLocal(thumbVideo.thumbnailKey!));
      expect(thumbnail.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
      expect(transcribe.mock.calls[0]?.[1]).toMatchObject({ language: 'hi', vocabulary: ['Minecraft', 'search bar'] });
      expect((await db.caption.findFirstOrThrow({ where: { videoId: result.video.id } })).text).toBe('aaj game');
      expect((await db.transcriptWord.findFirstOrThrow({ where: { transcript: { videoId: result.video.id } }, orderBy: { index: 'asc' } })).text).toBe('आज');
      const response = await regenerate(new Request('http://test/process', { method: 'POST', body: JSON.stringify({ videoId: result.video.id, outputLanguage: 'english', templateId: 'clean', vocabulary: ['search bar'] }) }), { params: { id: result.project.id } });
      expect(response.status).toBe(201);
      const next = await db.renderJob.findUniqueOrThrow({ where: { id: (await response.json()).jobId } });
      expect(JSON.parse(next.input!)).toEqual({ outputLanguage: 'english', templateId: 'clean', vocabulary: ['search bar'] });
      transcribe.mockImplementation(async () => ({ language: 'en', script: 'en', duration: 3, confidence: .9, words: [{ id: crypto.randomUUID(), text: 'Hello', start: .2, end: 1, confidence: .9 }], sentences: [], silences: [] }));
      await processPipelineJob(db, env, store, next);
      expect(transcribe.mock.calls[1]?.[1]).toMatchObject({ language: 'en', vocabulary: ['search bar'] });
      const reloaded = await (await getProject(new Request('http://test/project'), { params: { id: result.project.id } })).json();
      expect(JSON.parse(reloaded.renders[0].input).vocabulary).toEqual(['search bar']);
      expect((await db.caption.findFirstOrThrow({ where: { videoId: result.video.id } })).text).toBe('Hello');
      // A provider ignoring the requested language must not overwrite good captions.
      transcribe.mockImplementation(async () => ({ language: 'en', script: 'mixed', duration: 3, confidence: .9, words: [{ id: crypto.randomUUID(), text: '\u06c1\u0644\u0648', start: .2, end: 1, confidence: .9 }], sentences: [], silences: [] }));
      const exportsBefore = await db.export.count({ where: { projectId: result.project.id } });
      await expect(processPipelineJob(db, env, store, next)).rejects.toThrow('outside the selected English/Hinglish');
      expect((await db.caption.findFirstOrThrow({ where: { videoId: result.video.id } })).text).toBe('Hello');
      expect(await db.export.count({ where: { projectId: result.project.id } })).toBe(exportsBefore);
    } finally { factory.mockRestore(); }
  });
  it('offsets chunk timestamps back onto the original video timeline', async () => {
    const transcript = await transcribeAudio(env, { name: 'fixture', transcribe: async () => ({ language: 'en', script: 'en', duration: 1, confidence: 0, words: [{ id: crypto.randomUUID(), text: 'hello', start: .1, end: .8, confidence: 0 }], sentences: [], silences: [] }) }, source, 3, 'en', dir, 1);
    expect(transcript.words.map(w => w.start)).toEqual([.1, 1.1, 2.1]);
    expect(transcript.duration).toBe(3);
  });
  it('resolves one shared default storage root from both application workspaces', () => {
    expect(defaultStorageRoot(path.resolve('../web'))).toBe(defaultStorageRoot(process.cwd()));
    expect(defaultStorageRoot(process.cwd())).toBe(path.resolve('../../storage'));
  });
  it('persists video-associated demo captions and a real SRT; retry replaces instead of duplicates', async () => {
    const form = new FormData();
    form.set('file', new File([new Uint8Array(await readFile(source))], 'sample.mp4', { type: 'video/mp4' }));
    form.set('outputLanguage', 'hinglish');
    form.set('templateId', 'gold');
    const response = await upload(new Request('http://test/api/upload', { method: 'POST', body: form }));
    expect(response.status).toBe(201);
    const data = await response.json(); videoId = data.video.id; jobId = data.jobId;
    const job = await db.renderJob.findUniqueOrThrow({ where: { id: jobId } });
    expect(JSON.parse(job.input!)).toEqual({ outputLanguage: 'hinglish', templateId: 'gold' });
    await processPipelineJob(db, env, store, job);
    const count = await db.caption.count({ where: { videoId, clipId: null } });
    expect(count).toBeGreaterThan(0);
    const captions = await db.caption.findMany({ where: { videoId } });
    expect(captions.every(c => c.script === 'hi-latn' && !/[\u0900-\u097f]/.test(c.text))).toBe(true);
    expect(JSON.parse(captions[0]!.data!).style.font).toBe('Anton');
    expect(await db.caption.count({ where: { videoId: null, clipId: null } })).toBe(0);
    const output = await db.export.findFirstOrThrow({ where: { projectId: job.projectId, platform: 'srt' } });
    expect((await store.get(output.outputKey!)).toString()).toContain('-->');
    expect((await db.renderJob.findUniqueOrThrow({ where: { id: jobId } })).message).toContain('synthetic');
    await db.renderJob.update({ where: { id: jobId }, data: { error: 'stale conversion error' } });
    await processPipelineJob(db, env, store, job);
    expect(await db.caption.count({ where: { videoId } })).toBe(count);
    expect(await db.transcript.count({ where: { videoId } })).toBe(1);
    expect((await db.renderJob.findUniqueOrThrow({ where: { id: jobId } })).error).toBeNull();
  });
  it('persists English and Hindi word corrections/timing, exports latest text, rejects stale and invalid edits', async () => {
    const response = await getCaptions(new Request('http://test/captions'), ctx());
    const data = await response.json();
    data.captions[0] = replaceLine(data.captions[0], 'Hello नमस्ते दुनिया');
    const first = data.captions[0];
    data.captions[0] = retimeCaption(first, first.start + .01, first.end - .01);
    const request = () => new Request('http://test/edit', { method: 'PUT', body: JSON.stringify({ revision: data.revision, document: { captions: data.captions, style: data.style } }) });
    expect((await edit(request(), ctx())).status).toBe(200);
    expect((await edit(request(), ctx())).status).toBe(409);
    const refreshed = await (await getCaptions(new Request('http://test/captions'), ctx())).json();
    expect(refreshed.captions[0].text).toBe('Hello नमस्ते दुनिया');
    expect(refreshed.captions[0].start).toBeCloseTo(.01);
    const srt = await getCaptions(new Request('http://test/captions?format=srt'), ctx());
    expect(srt.headers.get('Content-Disposition')).toContain('attachment');
    expect(await srt.text()).toContain('Hello नमस्ते दुनिया');
    const vtt = await getCaptions(new Request('http://test/captions?format=vtt'), ctx());
    expect(await vtt.text()).toContain('WEBVTT');
    refreshed.captions[0].start = -2;
    expect((await edit(new Request('http://test/edit', { method: 'PUT', body: JSON.stringify({ revision: refreshed.revision, document: refreshed }) }), ctx())).status).toBe(400);
  });
  it('isolates reads, edits and exports from another user', async () => {
    const owner = state.userId; state.userId = 'another-user';
    try {
      expect((await getCaptions(new Request('http://test/captions'), ctx())).status).toBe(404);
      expect((await edit(new Request('http://test/edit', { method: 'PUT', body: '{}' }), ctx())).status).toBe(404);
      expect((await render(new Request('http://test/render', { method: 'POST', body: '{}' }), ctx())).status).toBe(404);
    } finally { state.userId = owner; }
  });
  it('renders the full saved snapshot at source dimensions without changing source media', async () => {
    const before = await readFile(source);
    const data = await (await getCaptions(new Request('http://test/captions'), ctx())).json();
    const res = await render(new Request('http://test/render', { method: 'POST', body: JSON.stringify({ revision: data.revision }) }), ctx());
    expect(res.status).toBe(201);
    const { jobId: id } = await res.json();
    const job = await db.renderJob.findUniqueOrThrow({ where: { id } });
    await processCaptionExport(db, env, store, job);
    const completed = await db.renderJob.findUniqueOrThrow({ where: { id } });
    expect(completed.status).toBe('completed');
    const meta = await probeVideo(env, await store.resolveLocal(completed.outputKey!));
    expect(meta.width).toBe(640); expect(meta.height).toBe(360); expect(meta.duration).toBeGreaterThanOrEqual(3);
    expect(await readFile(source)).toEqual(before);
    expect(await db.export.count({ where: { platform: 'captioned-video', status: 'ready', outputKey: completed.outputKey } })).toBe(1);
  });
  it('fails silent audio truthfully without a caption or export record', async () => {
    const silent = path.join(dir, 'silent.mp4');
    await runFfmpeg(env, { args: ['-y', '-f', 'lavfi', '-i', 'color=c=black:s=320x240:d=1', '-f', 'lavfi', '-i', 'anullsrc=r=16000:cl=mono', '-t', '1', '-c:v', 'libx264', '-c:a', 'aac', silent] });
    const form = new FormData(); form.set('file', new File([new Uint8Array(await readFile(silent))], 'silent.mp4'));
    const data = await (await upload(new Request('http://test/upload', { method: 'POST', body: form }))).json();
    const job = await db.renderJob.findUniqueOrThrow({ where: { id: data.jobId } });
    await expect(processPipelineJob(db, env, store, job)).rejects.toThrow(/silent|quiet/);
    expect((await db.renderJob.findUniqueOrThrow({ where: { id: job.id } })).status).toBe('failed');
    expect(await db.caption.count({ where: { videoId: data.video.id } })).toBe(0);
    expect(await db.export.count({ where: { projectId: job.projectId } })).toBe(0);
  });
  it('rejects an empty provider response and marks a failed export without publishing a download', async () => {
    const form = new FormData(); form.set('file', new File([new Uint8Array(await readFile(source))], 'empty.mp4'));
    const data = await (await upload(new Request('http://test/upload', { method: 'POST', body: form }))).json();
    const job = await db.renderJob.findUniqueOrThrow({ where: { id: data.jobId } });
    const mock = vi.spyOn(ai, 'getTranscriptionProvider').mockReturnValueOnce({ name: 'empty-fixture', transcribe: async () => ({ language: 'en', script: 'en', duration: 3, confidence: 0, words: [], sentences: [], silences: [] }) });
    try { await expect(processPipelineJob(db, env, store, job)).rejects.toThrow('No speech'); }
    finally { mock.mockRestore(); }
    expect(await db.caption.count({ where: { videoId: data.video.id } })).toBe(0);
    expect((await db.video.findUniqueOrThrow({ where: { id: data.video.id } })).status).toBe('error');
    const current = await (await getCaptions(new Request('http://test/captions'), ctx())).json();
    const res = await render(new Request('http://test/render', { method: 'POST', body: JSON.stringify({ revision: current.revision }) }), ctx());
    const { jobId: exportJobId } = await res.json();
    const exportJob = await db.renderJob.findUniqueOrThrow({ where: { id: exportJobId } });
    await expect(processCaptionExport(db, { ...env, ffmpeg: { ...env.ffmpeg, path: 'clipx-missing-ffmpeg' } }, store, exportJob)).rejects.toThrow();
    const failed = await db.renderJob.findUniqueOrThrow({ where: { id: exportJob.id } });
    expect(failed.status).toBe('failed'); expect(failed.outputKey).toBeNull();
    expect((await db.export.findUniqueOrThrow({ where: { id: JSON.parse(exportJob.input!).exportId } })).status).toBe('failed');
  });
  it('deletes only owned projects and their files; protects active work and cancels queued jobs', async () => {
    const project = await db.project.create({ data: { name: 'Delete fixture', userId: state.userId } });
    const key = `users/${state.userId}/projects/${project.id}/source.mp4`;
    await store.put(key, Buffer.from('fixture'));
    const video = await db.video.create({ data: { projectId: project.id, sourceKey: key, originalFilename: 'fixture.mp4' } });
    const job = await db.renderJob.create({ data: { projectId: project.id, videoId: video.id, userId: state.userId, status: 'rendering' } });
    const context = { params: { id: project.id } };
    const request = () => new Request('http://test/delete', { method: 'DELETE' });
    const owner = state.userId;
    state.userId = 'other';
    expect((await deleteProject(request(), context)).status).toBe(404);
    state.userId = owner;
    expect((await deleteProject(request(), context)).status).toBe(409);
    await db.renderJob.update({ where: { id: job.id }, data: { status: 'queued' } });
    expect((await deleteProject(request(), context)).status).toBe(200);
    expect(await db.project.findUnique({ where: { id: project.id } })).toBeNull();
    expect(await db.renderJob.findUnique({ where: { id: job.id } })).toBeNull();
    await expect(store.get(key)).rejects.toThrow();
    expect(await db.video.findUnique({ where: { id: videoId } })).not.toBeNull();
  });
});
