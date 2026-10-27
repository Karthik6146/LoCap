import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Temporary: auth disabled for local testing.
 * All routes accessible without authentication.
 */
export function middleware(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ['/app/:path*', '/editor/:path*'],
};