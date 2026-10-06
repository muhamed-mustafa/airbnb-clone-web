import { NextResponse, type NextRequest } from 'next/server';
import { getRefreshCoordinator } from '@/server/refresh-coordinator';
import { readSession } from '@/server/session';
import { safeNextPath } from '@/lib/safe-next-path';

/**
 * Page guard: send visitors without a readable admin session to /login.
 * This is navigation only. Authorization happens in the BFF and, finally, in the backend.
 */
export async function proxy(request: NextRequest) {
  const session = await readSession(request);
  const signedIn = session !== undefined && !getRefreshCoordinator().isRevoked(session.sid);
  const { pathname, search } = request.nextUrl;

  if (pathname === '/login') {
    if (!signedIn) return NextResponse.next();
    const next = safeNextPath(request.nextUrl.searchParams.get('next'));
    return NextResponse.redirect(new URL(next, request.url));
  }

  if (signedIn) return NextResponse.next();
  const login = new URL('/login', request.url);
  login.searchParams.set('next', `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  // Everything except the BFF, Next internals and static files.
  matcher: ['/((?!bff/|_next/|favicon.ico|.*\\.[a-z0-9]+$).*)'],
};
