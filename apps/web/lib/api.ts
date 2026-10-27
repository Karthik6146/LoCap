import { NextResponse } from 'next/server';

/** Standard JSON response. */
export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

/**
 * Safe error → JSON. Never leaks raw stack traces to the client (spec 50);
 * full detail is logged server-side only.
 */
export function apiError(err: unknown, status = 500) {
  console.error('[api]', err);
  const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
  return NextResponse.json({ error: message }, { status });
}

/** User-facing messages for known failures. */
export function friendly(message: string): string {
  return message;
}
