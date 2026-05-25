'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ChevronDown } from 'lucide-react';

import { NavigationGuardLink } from '@/components/navigation-guard-link';
import { SchedulerActiveJobsPoller, SchedulerActiveStatus } from '@/components/scheduler-active-status';
import { buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getNav, type NavItem, type NavLeaf } from '@/routes';
import { cn } from '@/lib/utils';

const NAV_GAP_PX = 2;

function isNavActive(url: string, pathname: string) {
  if (url === '#') return false;
  if (url === '/') return pathname === '/';
  return pathname === url || pathname.startsWith(`${url}/`);
}

function isMenuOnlySection(item: NavItem) {
  return item.menuOnly === true || item.url === '#';
}

function navSectionActive(item: NavItem, pathname: string) {
  if (!isMenuOnlySection(item) && isNavActive(item.url, pathname)) return true;
  return item.items?.some((sub) => isNavActive(sub.url, pathname)) ?? false;
}

function leafActive(leaf: NavLeaf, pathname: string) {
  return isNavActive(leaf.url, pathname);
}

function findActiveNavIndex(navMain: readonly NavItem[], pathname: string): number {
  return navMain.findIndex((item) => navSectionActive(item, pathname));
}

const navLinkClass = (active: boolean) =>
  cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'shrink-0 gap-1.5', active && 'bg-muted text-foreground');

const moreMenuTriggerClass = (active: boolean) =>
  cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), 'shrink-0', active && 'bg-muted text-foreground');

function totalNavWidth(widths: readonly number[], visibleCount: number, moreWidth: number, gap: number): number {
  if (visibleCount <= 0) return 0;
  let total = widths.slice(0, visibleCount).reduce((sum, w) => sum + w, 0);
  total += gap * Math.max(0, visibleCount - 1);
  if (visibleCount < widths.length) total += gap + moreWidth;
  return total;
}

function computeVisibleCount(
  widths: readonly number[],
  available: number,
  moreWidth: number,
  activeIndex: number,
): number {
  const n = widths.length;
  if (n === 0 || available <= 0) return 0;

  let visible = n;
  for (let k = n; k >= 0; k--) {
    if (totalNavWidth(widths, k, moreWidth, NAV_GAP_PX) <= available) {
      visible = k;
      break;
    }
  }

  if (activeIndex >= 0 && activeIndex >= visible) {
    const withActive = Math.min(activeIndex + 1, n);
    if (totalNavWidth(widths, withActive, moreWidth, NAV_GAP_PX) <= available) {
      visible = withActive;
    }
  }

  return visible;
}

function TopNavLeafLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isNavActive(item.url, pathname);
  return (
    <NavigationGuardLink href={item.url} className={navLinkClass(active)}>
      <span className="whitespace-nowrap">{item.title}</span>
    </NavigationGuardLink>
  );
}

function TopNavSectionMenuItems({ item, pathname }: { item: NavItem; pathname: string }) {
  return (
    <>
      {(item.items ?? []).map((sub) => {
        const subActive = leafActive(sub, pathname);
        return (
          <DropdownMenuItem
            key={sub.url}
            className={cn(subActive && 'bg-muted')}
            render={
              <NavigationGuardLink href={sub.url} className="flex w-full items-center">
                <span>{sub.title}</span>
              </NavigationGuardLink>
            }
          />
        );
      })}
    </>
  );
}

function TopNavSectionDropdown({ item, pathname }: { item: NavItem; pathname: string }) {
  const sectionActive = navSectionActive(item, pathname);
  const menuOnly = isMenuOnlySection(item);

  if (menuOnly) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger className={cn(navLinkClass(sectionActive), 'gap-1')} aria-label={`${item.title} 子菜单`}>
          <span className="whitespace-nowrap">{item.title}</span>
          <ChevronDown className="size-4 shrink-0 opacity-70" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <TopNavSectionMenuItems item={item} pathname={pathname} />
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  const parentActive = isNavActive(item.url, pathname);

  return (
    <div className="flex shrink-0 items-center">
      <NavigationGuardLink href={item.url} className={cn(navLinkClass(parentActive), 'rounded-r-none pr-1.5')}>
        <span className="whitespace-nowrap">{item.title}</span>
      </NavigationGuardLink>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            buttonVariants({ variant: 'ghost', size: 'sm' }),
            'rounded-l-none px-1.5',
            sectionActive && 'bg-muted text-foreground',
          )}
          aria-label={`${item.title} 子菜单`}
        >
          <ChevronDown className="size-4" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <TopNavSectionMenuItems item={item} pathname={pathname} />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function TopNavItem({ item, pathname }: { item: NavItem; pathname: string }) {
  if (item.items?.length) return <TopNavSectionDropdown item={item} pathname={pathname} />;
  return <TopNavLeafLink item={item} pathname={pathname} />;
}

function TopNavOverflowEntry({ item, pathname }: { item: NavItem; pathname: string }) {
  const sectionActive = navSectionActive(item, pathname);

  if (!item.items?.length) {
    const active = isNavActive(item.url, pathname);
    return (
      <DropdownMenuItem
        className={cn(active && 'bg-muted')}
        render={
          <NavigationGuardLink href={item.url} className="flex w-full items-center">
            <span>{item.title}</span>
          </NavigationGuardLink>
        }
      />
    );
  }

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className={cn(sectionActive && 'bg-muted')}>
        <span>{item.title}</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        {(item.items ?? []).map((sub) => {
          const subActive = leafActive(sub, pathname);
          return (
            <DropdownMenuItem
              key={sub.url}
              className={cn(subActive && 'bg-muted')}
              render={
                <NavigationGuardLink href={sub.url} className="flex w-full items-center">
                  <span>{sub.title}</span>
                </NavigationGuardLink>
              }
            />
          );
        })}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

function TopNavMoreMenu({ items, pathname }: { items: readonly NavItem[]; pathname: string }) {
  const overflowActive = items.some((item) => navSectionActive(item, pathname));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={moreMenuTriggerClass(overflowActive)} aria-label="更多导航">
        <ChevronDown className="size-5" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        {items.map((item) => (
          <TopNavOverflowEntry key={item.title} item={item} pathname={pathname} />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TopNavLinks({ navMain, pathname }: { navMain: readonly NavItem[]; pathname: string }) {
  const navRef = useRef<HTMLElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const itemMeasureRefs = useRef<(HTMLDivElement | null)[]>([]);
  const moreMeasureRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(navMain.length);

  const recompute = useCallback(() => {
    const container = navRef.current;
    if (!container || navMain.length === 0) {
      setVisibleCount(0);
      return;
    }

    const available = container.clientWidth;
    const widths = navMain.map((_, index) => itemMeasureRefs.current[index]?.offsetWidth ?? 0);
    const moreWidth = moreMeasureRef.current?.offsetWidth ?? 32;
    const activeIndex = findActiveNavIndex(navMain, pathname);

    setVisibleCount(computeVisibleCount(widths, available, moreWidth, activeIndex));
  }, [navMain, pathname]);

  useLayoutEffect(() => {
    const container = navRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => recompute());
    observer.observe(container);
    return () => observer.disconnect();
  }, [recompute]);

  const overflowItems = navMain.slice(visibleCount);
  const hasOverflow = overflowItems.length > 0;

  return (
    <>
      <div
        ref={measureRef}
        aria-hidden
        className="pointer-events-none invisible absolute -left-[9999px] top-0 flex items-center gap-0.5"
      >
        {navMain.map((item, index) => (
          <div
            key={item.title}
            ref={(el) => {
              itemMeasureRefs.current[index] = el;
            }}
            className="shrink-0"
          >
            <TopNavItem item={item} pathname={pathname} />
          </div>
        ))}
        <div ref={moreMeasureRef} className="shrink-0">
          <span className={moreMenuTriggerClass(false)}>
            <ChevronDown className="size-5" aria-hidden />
          </span>
        </div>
      </div>

      <nav ref={navRef} aria-label="主导航" className="flex min-w-0 flex-1 items-center gap-0.5 overflow-hidden">
        {navMain.slice(0, visibleCount).map((item) => (
          <TopNavItem key={item.title} item={item} pathname={pathname} />
        ))}
        {hasOverflow ? <TopNavMoreMenu items={overflowItems} pathname={pathname} /> : null}
      </nav>
    </>
  );
}

export function AppTopNav() {
  const pathname = usePathname();
  const navMain = getNav();

  return (
    <header
      className="relative flex h-14 shrink-0 items-center gap-2 border-b border-border bg-sidebar px-3"
      role="banner"
    >
      <NavigationGuardLink
        href="/"
        className="shrink-0 text-sm font-semibold tracking-tight whitespace-nowrap hover:text-foreground/80"
      >
        quant-agent
      </NavigationGuardLink>

      <TopNavLinks navMain={navMain} pathname={pathname} />

      <div className="flex shrink-0 items-center gap-2">
        <SchedulerActiveJobsPoller />
        <SchedulerActiveStatus />
      </div>
    </header>
  );
}
