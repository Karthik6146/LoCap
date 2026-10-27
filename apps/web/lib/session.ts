import { prisma } from '@clipx/database';

export interface SessionUser {
  id: string;
  email?: string | null;
  name?: string | null;
}

// Auth is disabled for local testing — pages and API routes resolve to the
// seeded demo user. Set AUTH_FORCE_USER to impersonate a different account.
const DEMO_EMAIL = 'demo@clipx.app';

/** Get the active user in a server component / route (falls back to the demo user). */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const email = (process.env.AUTH_FORCE_USER || DEMO_EMAIL).toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null;
  return { id: user.id, email: user.email, name: user.name };
}