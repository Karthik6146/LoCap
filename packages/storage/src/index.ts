import type { Env } from '@clipx/types';
import type { Storage } from './types';
import { LocalStorage } from './local';
import { S3Storage } from './s3';

export type { Storage } from './types';
export { LocalStorage } from './local';
export { S3Storage } from './s3';

/**
 * Storage factory. Prefers S3 when reachable; falls back to local dev storage.
 * Callers should resolve once and cache.
 */
export async function getStorage(env: Env): Promise<Storage> {
  const s3 = new S3Storage(env);
  if (await s3.isAvailable()) return s3;
  return new LocalStorage(env.storageRoot);
}
