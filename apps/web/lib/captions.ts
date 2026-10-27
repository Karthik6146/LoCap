import { createHash } from 'node:crypto';
import type { Caption as Row } from '@prisma/client';
import type { Caption } from '@clipx/types';
import { EDITOR_STYLE } from '@clipx/captions';
export function captionDocument(rows: Row[]) {
  return {
    captions: rows.map((c): Caption => ({ ...c, clipId: '', script: c.script as Caption['script'], grouping: c.grouping as Caption['grouping'], words: JSON.parse(c.words) })),
    style: rows[0]?.data ? JSON.parse(rows[0].data).style ?? EDITOR_STYLE : EDITOR_STYLE,
  };
}
export function captionRevision(rows: Row[]) {
  return createHash('sha256').update(JSON.stringify(rows)).digest('hex');
}

