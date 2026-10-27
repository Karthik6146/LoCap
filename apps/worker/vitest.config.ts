import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('../web', import.meta.url)) } },
  test: { testTimeout: 60000, hookTimeout: 60000, fileParallelism: false },
});
