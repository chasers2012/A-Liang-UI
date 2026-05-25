import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { isPathAccessible } from '@/routes';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!isPathAccessible(pathname)) {
    return NextResponse.rewrite(new URL('/not-found', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
