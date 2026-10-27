import { getStorage } from '@clipx/storage';
import { env } from './env';

let cached: ReturnType<typeof getStorage> | null = null;

/** Cached storage instance (S3 when reachable, else local dev). */
export function storage() {
  if (!cached) cached = getStorage(env());
  return cached;
}
