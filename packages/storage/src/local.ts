/**
 * LocalStorage — zero-dependency dev backend. Writes to a local directory and
 * serves files through the app's own HTTP layer (see web /api/files route).
 * Not for production; production uses S3Storage.
 */

import { promises as fs, createWriteStream, existsSync } from 'node:fs';
import type { Readable } from 'node:stream';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Storage } from './types';

export function defaultStorageRoot(cwd = process.cwd()): string {
  let current = path.resolve(cwd);
  while (true) {
    if (existsSync(path.join(current, 'packages/database/prisma/schema.prisma'))) return path.join(current, 'storage');
    const parent = path.dirname(current);
    if (parent === current) return path.resolve(cwd, 'storage');
    current = parent;
  }
}

export class LocalStorage implements Storage {
  readonly kind = 'local' as const;
  readonly root: string;

  constructor(root?: string) {
    this.root = root ? path.resolve(root) : defaultStorageRoot();
  }

  private async resolve(key: string): Promise<string> {
    const abs = path.resolve(this.root, key);
    // Guard against path traversal (spec section 46).
    const rel = path.relative(this.root, abs);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      throw new Error('Invalid storage key');
    }
    await fs.mkdir(path.dirname(abs), { recursive: true });
    return abs;
  }

  async put(key: string, body: Buffer | NodeJS.ReadableStream): Promise<void> {
    const abs = await this.resolve(key);
    if (Buffer.isBuffer(body)) {
      await fs.writeFile(abs, body);
    } else {
      // Stream into the file.
      await new Promise<void>((res, rej) => {
        const stream = body as Readable;
        const out = createWriteStream(abs);
        stream.pipe(out);
        out.on('finish', () => res());
        out.on('error', rej);
        stream.on('error', rej);
      });
    }
  }

  async get(key: string): Promise<Buffer> {
    return fs.readFile(await this.resolve(key));
  }

  async resolveLocal(key: string): Promise<string> {
    return this.resolve(key);
  }

  async getSignedUrl(key: string, _opts?: { expiresInSec?: number }): Promise<string> {
    // Dev: direct HTTP path served by the web app.
    return `/api/files?key=${encodeURIComponent(key)}`;
  }

  async getSignedUploadUrl(key: string): Promise<string> {
    // Dev: uploads go straight to an app endpoint with the key.
    return `/api/upload?key=${encodeURIComponent(key)}`;
  }

  async delete(key: string): Promise<void> {
    await fs.rm(await this.resolve(key), { force: true });
  }

  async isAvailable(): Promise<boolean> {
    try {
      await fs.mkdir(this.root, { recursive: true });
      return true;
    } catch {
      return false;
    }
  }

  /** Generate a safe unique key within a folder. */
  static key(folder: string, filename: string): string {
    return `${folder}${Date.now()}-${randomUUID().slice(0, 8)}-${path.basename(filename)}`;
  }
}
