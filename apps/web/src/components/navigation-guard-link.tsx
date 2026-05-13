'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentProps, MouseEvent, ReactNode } from 'react';

import { useNavigationEditGuardShell } from '@/components/navigation-edit-guard-context';
import { pathnameFromHref } from '@/lib/navigation-edit-path';

type NavigationGuardLinkProps = ComponentProps<typeof Link> & { children?: ReactNode };

function hrefToString(href: ComponentProps<typeof Link>['href']): string | null {
  if (typeof href === 'string') return href;
  if (href && typeof href === 'object' && 'pathname' in href) {
    const o = href as { pathname?: string | null; search?: string | null; hash?: string | null };
    const p = o.pathname ?? '';
    const s = o.search && String(o.search).startsWith('?') ? o.search : o.search ? `?${o.search}` : '';
    const h = o.hash ?? '';
    if (!p && !s && !h) return null;
    return `${p.startsWith('/') ? p : `/${p}`}${s}${h}`;
  }
  return null;
}

/**
 * 当当前路由下挂载了 {@link useNavigationEditGuard} 且编辑态为 true 时，拦截站内链接跳转并弹出确认框。
 */
export function NavigationGuardLink({ href, onClick, children, ...rest }: NavigationGuardLinkProps) {
  const pathname = usePathname();
  const shell = useNavigationEditGuardShell();

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;

    const hrefStr = hrefToString(href);
    if (hrefStr == null || hrefStr === '' || hrefStr.startsWith('http://') || hrefStr.startsWith('https://')) return;

    const path = pathnameFromHref(hrefStr);
    if (!path.startsWith('/')) return;

    if (!shell) return;
    if (!shell.tryDeferNavigation(hrefStr, pathname)) return;

    e.preventDefault();
  };

  return (
    <Link href={href} onClick={handleClick} {...rest}>
      {children}
    </Link>
  );
}
