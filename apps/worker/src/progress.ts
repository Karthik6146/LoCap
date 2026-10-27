/**
 * RenderJob progress helper — writes real backend stage + progress to the DB.
 * Stages map to spec section 44 / 63 (never fake progress).
 */

import type { prisma } from '@clipx/database';
import type { RenderJobStatus } from '@clipx/types';

export type Db = typeof prisma;

export async function setJob(
  db: Db,
  jobId: string,
  patch: {
    status?: RenderJobStatus;
    progress?: number;
    message?: string;
    error?: string | null;
    outputKey?: string | null;
  },
): Promise<void> {
  await db.renderJob.update({
    where: { id: jobId },
    data: {
      ...(patch.status ? { status: patch.status } : {}),
      ...(patch.progress != null ? { progress: patch.progress } : {}),
      ...(patch.message != null ? { message: patch.message } : {}),
      ...(patch.error !== undefined ? { error: patch.error } : {}),
      ...(patch.outputKey !== undefined ? { outputKey: patch.outputKey } : {}),
    },
  });
}
