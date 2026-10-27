// Render check: every caption template must look the same in the Caption studio preview and in the burned MP4.
// Run after NEXT_BUILD_DIR=.next-verify npx next build, with the same NEXT_BUILD_DIR.
import { chromium } from 'playwright';
import { PrismaClient } from '@prisma/client';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createServer } from 'node:net';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { CAPTION_TEMPLATES, templateStyle, captionsToBurnGroups } from '@clipx/captions';
import { loadEnv } from '@clipx/types';
import { burnCaptions, runFfmpeg } from '@clipx/video-engine';
import { LocalStorage } from '@clipx/storage';

const W = 640, H = 360, T = 1.0, BG = 32;
const SAMPLES = { roman: 'Aaj hum website bana rahe', mixed: 'आज website क्षेत्र में है', devanagari: 'आज कुछ नया सीखते हैं' };
const started = Date.now();
const root = path.resolve('../..');
const dir = await mkdtemp(path.join(tmpdir(), 'clipx-render-'));
const databaseUrl = 'file:' + path.join(dir, 'render.db').replaceAll('\\', '/');
await writeFile(path.join(dir, 'render.db'), '');
const env = { ...process.env, DATABASE_URL: databaseUrl, AUTH_FORCE_USER: 'render@example.invalid', STORAGE_ROOT: path.join(dir, 'storage'), S3_ENDPOINT: 'http://127.0.0.1:1', TRANSCRIPTION_API_KEY: '' };
const engineEnv = loadEnv(env);
const ffmpeg = (...args) => execFileSync(engineEnv.ffmpeg.path, ['-v', 'error', '-y', ...args], { windowsHide: true, maxBuffer: 1 << 24 });
const filterPath = p => p.replace(/\\/g, '/').replace(/:/g, '\\:');
const font = filterPath(path.join(root, 'apps/web/public/fonts/Poppins-Regular.ttf'));
execFileSync(process.execPath, [path.join(root, 'node_modules/prisma/build/index.js'), 'db', 'push', '--schema', path.join(root, 'packages/database/prisma/schema.prisma'), '--skip-generate'], { env, windowsHide: true });
const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

// Grayscale 640x360 bytes of any image; both sides go through the same conversion.
const gray = file => ffmpeg('-i', file, '-vf', `scale=${W}:${H},format=gray`, '-f', 'rawvideo', '-');
// Caption bounding box: pixels that differ clearly from the #202020 background.
function bbox(buf) {
  let left = W, right = -1, top = H, bottom = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (Math.abs(buf[y * W + x] - BG) > 40) {
    if (x < left) left = x; if (x > right) right = x; if (y < top) top = y; if (y > bottom) bottom = y;
  }
  return right < 0 ? null : { left, right, top, bottom };
}
function matches(a, b) {
  if (!a || !b) return false;
  return Math.abs(a.left - b.left) <= W * .06 && Math.abs(a.right - b.right) <= W * .06 && Math.abs(a.top - b.top) <= H * .06 && Math.abs(a.bottom - b.bottom) <= H * .06;
}
const fmt = b => b ? `l${b.left} r${b.right} t${b.top} b${b.bottom}` : 'empty';
// Largest edge difference in px, shown next to PASS/FAIL.
const delta = ({ exported: a, previewed: b }) => a && b ? Math.max(...['left', 'right', 'top', 'bottom'].map(k => Math.abs(a[k] - b[k]))) + 'px' : '-';
// Self-check of the box/threshold logic on synthetic frames.
{
  const frame = Buffer.alloc(W * H, BG); frame.fill(255, 100 * W + 50, 100 * W + 60); frame[200 * W + 300] = 80;
  const box = bbox(frame);
  if (!(box.left === 50 && box.right === 300 && box.top === 100 && box.bottom === 200) || bbox(Buffer.alloc(W * H, BG + 40)) !== null) throw new Error('bbox self-check failed');
  if (!matches(box, { ...box, left: 50 + 38 }) || matches(box, { ...box, left: 50 + 39 }) || matches(box, null)) throw new Error('threshold self-check failed');
}

const words = text => text.split(' ').map((t, i) => ({ id: `w${i}`, transcriptWordId: '', text: t, start: i * .3, end: i * .3 + .25 }));
let server, browser, failed = 0;
const results = {};
try {
  const user = await db.user.create({ data: { email: env.AUTH_FORCE_USER } });
  const project = await db.project.create({ data: { userId: user.id, name: 'Render check', status: 'ready' } });
  const key = `users/${user.id}/projects/${project.id}/source.mp4`;
  const source = await new LocalStorage(env.STORAGE_ROOT).resolveLocal(key);
  await mkdir(path.dirname(source), { recursive: true });
  await runFfmpeg(engineEnv, { args: ['-y', '-f', 'lavfi', '-i', `color=c=0x202020:s=${W}x${H}:r=30:d=2`, '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', source], duration: 2 });
  const video = await db.video.create({ data: { projectId: project.id, originalFilename: 'render-check.mp4', sourceKey: key, proxyKey: key, status: 'ready', metadata: JSON.stringify({ width: W, height: H, duration: 2 }) } });

  const port = await new Promise(resolve => { const s = createServer().listen(0, () => { const { port } = s.address(); s.close(() => resolve(port)); }); });
  server = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'start', '-p', String(port)], { cwd: process.cwd(), env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; server.stdout.on('data', d => log += d); server.stderr.on('data', d => log += d);
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`http://localhost:${port}/api/captions/${video.id}`)).ok) break; } catch {}
    if (i === 99) throw new Error('Server failed to start: ' + log);
    await new Promise(r => setTimeout(r, 200));
  }
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await mkdir(path.join(root, 'artifacts'), { recursive: true });

  for (const [script, text] of Object.entries(SAMPLES)) {
    const frames = path.join(dir, 'frames', script);
    await mkdir(frames, { recursive: true });
    for (const [index, template] of CAPTION_TEMPLATES.entries()) {
      const style = templateStyle(template.id, H);
      const caption = { text, start: 0, end: 2, words: words(text) };
      // Export: the worker's path (caption rows -> burn groups -> libass).
      const out = path.join(dir, 'burn', `${script}-${template.id}.mp4`);
      await burnCaptions(engineEnv, source, out, { width: W, height: H, style, groups: captionsToBurnGroups([caption]) });
      const plain = path.join(frames, `plain-${template.id}.png`), label = path.join(frames, `label-${template.id}.txt`);
      await writeFile(label, template.name);
      ffmpeg('-ss', String(T), '-i', out, '-frames:v', '1', plain, '-frames:v', '1', '-vf', `drawtext=fontfile='${font}':textfile='${filterPath(label)}':fontsize=18:fontcolor=white:box=1:boxcolor=black@0.7:boxborderw=6:x=8:y=8`, path.join(frames, `${String(index).padStart(2, '0')}.png`));
      // Preview: same document stored as Caption rows, rendered by the Caption studio.
      await db.caption.deleteMany({ where: { videoId: video.id } });
      await db.caption.create({ data: { videoId: video.id, text, start: 0, end: 2, order: 0, styleId: template.id, words: JSON.stringify(caption.words), data: JSON.stringify({ style }) } });
      await page.goto(`http://localhost:${port}/app/captions/${video.id}`);
      const guide = page.getByLabel('Safe placement guide (approximate)');
      if (await guide.isChecked()) await guide.uncheck();
      const preview = page.locator('.studio-preview');
      await preview.locator('video').evaluate(async v => {
        v.controls = false; v.parentElement.style.borderRadius = '0';
        if (v.readyState < 1) await new Promise(r => v.addEventListener('loadedmetadata', r, { once: true }));
        const seeked = new Promise(r => v.addEventListener('seeked', r, { once: true }));
        v.currentTime = 1.0; await seeked;
      });
      await preview.locator('[data-caption-overlay]').waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(150);
      const shot = path.join(frames, `preview-${template.id}.png`);
      await preview.screenshot({ path: shot });
      const exported = bbox(gray(plain)), previewed = bbox(gray(shot)), pass = matches(exported, previewed);
      if (!pass) failed++;
      (results[template.id] ??= {})[script] = { pass, exported, previewed };
    }
    ffmpeg('-framerate', '1', '-i', path.join(frames, '%02d.png'), '-vf', 'tile=8x5', '-frames:v', '1', path.join(root, `artifacts/template-contact-${script}.png`));
  }
  if (errors.length) throw new Error('Browser errors: ' + errors.join('; '));

  const scripts = Object.keys(SAMPLES), width = Math.max(...CAPTION_TEMPLATES.map(t => t.id.length));
  console.log(['template'.padEnd(width), ...scripts.map(s => s.padEnd(10))].join('  '));
  for (const { id } of CAPTION_TEMPLATES) console.log([id.padEnd(width), ...scripts.map(s => `${results[id][s].pass ? 'PASS' : 'FAIL'} ${delta(results[id][s])}`.padEnd(10))].join('  '));
  for (const { id } of CAPTION_TEMPLATES) for (const s of scripts) if (!results[id][s].pass) console.log(`FAIL ${id} ${s}: export ${fmt(results[id][s].exported)} | preview ${fmt(results[id][s].previewed)}`);
  console.log(`${CAPTION_TEMPLATES.length * scripts.length - failed}/${CAPTION_TEMPLATES.length * scripts.length} PASS in ${((Date.now() - started) / 1000).toFixed(0)}s; contact sheets: ${scripts.map(s => `artifacts/template-contact-${s}.png`).join(', ')}`);
} finally {
  await browser?.close();
  if (server) { server.kill(); await new Promise(resolve => server.once('exit', resolve)); }
  await db.$disconnect();
  await rm(dir, { recursive: true, force: true });
}
if (failed) process.exit(1);
