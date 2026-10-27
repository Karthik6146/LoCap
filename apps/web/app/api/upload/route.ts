import { prisma } from '@clipx/database';
import { parseGenerationOptions } from '@clipx/types';
import { isAllowedVideoExtension, fileExtension, MAX_UPLOAD_BYTES } from '@clipx/config';
import { getCurrentUser } from '@/lib/session';
import { storage } from '@/lib/storage';
import { json, apiError } from '@/lib/api';

export const runtime = 'nodejs';

/**
 * POST /api/upload — multipart video upload.
 * Validates the file, buffers multipart bytes to private storage, creates
 * Project+Video rows, and enqueues a pipeline job.
 */
export async function POST(req: Request) {
  let createdProjectId: string | undefined;
  let createdVideoId: string | undefined;
  try {
    const user = await getCurrentUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File) || file.size === 0) {
      return json({ error: 'No file provided.' }, 400);
    }

    const ext = fileExtension(file.name);
    if (!isAllowedVideoExtension(ext)) {
      return json({ error: 'Video format not supported. Use MP4, MOV, WEBM or MKV.' }, 415);
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return json({ error: 'File is too large (max 2 GB).' }, 413);
    }

    let settings;
    try { settings = parseGenerationOptions({ outputLanguage: form.get('outputLanguage') ?? undefined, templateId: form.get('templateId') ?? undefined, outputMode: form.get('outputMode') ?? undefined, vocabulary: form.has('vocabulary') ? JSON.parse(String(form.get('vocabulary'))) : undefined }); }
    catch (e) { return json({ error: (e as Error).message }, 400); }
    const name = form.get('name')?.toString() || file.name.replace(/\.[^.]+$/, '');
    const project = await prisma.project.create({
      data: { userId: user.id, name, status: 'processing' },
    });
    createdProjectId = project.id;
    const video = await prisma.video.create({
      data: {
        projectId: project.id,
        originalFilename: file.name,
        sourceKey: `users/${user.id}/projects/${project.id}/source/original.${ext}`,
        status: 'uploaded',
      },
    });
    createdVideoId = video.id;

    // Stream file bytes to storage (Buffer in dev/local; multipart to S3 later).
    const buf = Buffer.from(await file.arrayBuffer());
    const store = await storage();
    await store.put(video.sourceKey, buf, { contentType: file.type || 'video/mp4' });

    // Enqueue the processing pipeline.
    const job = await prisma.renderJob.create({
      data: {
        projectId: project.id,
        userId: user.id,
        videoId: video.id,
        type: 'pipeline',
        status: 'queued',
        message: 'Queued',
        input: JSON.stringify(settings),
      },
    });

    return json({ project, video, jobId: job.id }, 201);
  } catch (err) {
    const message = 'Upload could not be saved. Please upload the source again.';
    if (createdVideoId) await prisma.video.update({ where: { id: createdVideoId }, data: { status: 'error', error: message } }).catch(() => {});
    if (createdProjectId) await prisma.project.update({ where: { id: createdProjectId }, data: { status: 'error' } }).catch(() => {});
    return apiError(err);
  }
}
