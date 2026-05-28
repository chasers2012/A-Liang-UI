/** 从 href 中取出 pathname（忽略 query、hash），用于与 `usePathname()` 比较 */
export function pathnameFromHref(href: string): string {
  const q = href.indexOf('?');
  const h = href.indexOf('#');
  let end = href.length;
  if (q >= 0) end = Math.min(end, q);
  if (h >= 0) end = Math.min(end, h);
  const raw = end > 0 ? href.slice(0, end) : href;
  return raw.startsWith('/') ? raw : `/${raw}`;
}

function stripTrailingSlash(p: string): string {
  if (p.length > 1 && p.endsWith('/')) return p.slice(0, -1);
  return p;
}

/** 当前路由与目标 href 是否视为「同一页」（同 pathname 则不拦截） */
export function shouldConfirmNavigationAway(currentPathname: string, targetHref: string): boolean {
  const nextPath = stripTrailingSlash(pathnameFromHref(targetHref));
  const cur = stripTrailingSlash(currentPathname.split('?')[0] || '/');
  return nextPath !== cur;
}
