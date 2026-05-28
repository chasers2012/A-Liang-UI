'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { isPathAccessible } from '@/routes';

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isPathAccessible(pathname)) {
      router.replace('/');
    }
  }, [pathname, router]);

  return <>{children}</>;
}
