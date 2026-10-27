import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Load shared settings before Prisma, storage or providers initialize.
const envFile = fileURLToPath(new URL('../../../.env', import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);
await import('./index.js');
