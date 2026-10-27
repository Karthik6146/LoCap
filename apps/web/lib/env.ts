import { loadEnv } from '@clipx/types';

/** Lazily-loaded shared env for the web server. */
let cached: ReturnType<typeof loadEnv> | null = null;

export function env() {
  if (!cached) cached = loadEnv();
  return cached;
}
