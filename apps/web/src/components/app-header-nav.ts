'use client';

import { usePathname } from 'next/navigation';
import type { PageBreadcrumbItem } from '@/components/page-breadcrumb';
import { getNav } from '@/routes';

function isTopLevelByDepth(pathname: string): boolean {
  return pathname.split('/').filter(Boolean).length <= 1;
}

export function isTopLevelPath(pathname: string): boolean {
  return isTopLevelByDepth(pathname);
}

/** 主内容顶栏面包屑（基于 Next.js 当前路由） */
export function useAppHeaderBreadcrumbs(): PageBreadcrumbItem[] {
  const pathname = usePathname();
  const nav = getNav();
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return [{ label: nav[0]?.title ?? '首页' }];

  return segments.map((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join('/')}`;
    const isLast = index === segments.length - 1;
    const matchedMain = nav.find((item) => item.url === href);
    const matchedSub = nav.flatMap((item) => item.items ?? []).find((item) => item.url === href);
    return {
      label: matchedMain?.title ?? matchedSub?.title ?? segment,
      href: isLast ? undefined : href,
    };
  });
}
