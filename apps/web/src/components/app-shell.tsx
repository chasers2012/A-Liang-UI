'use client';

import * as React from 'react';

import { NavigationEditGuardDialog } from '@/components/navigation-edit-guard-dialog';
import { NavigationEditGuardProvider } from '@/components/navigation-edit-guard-context';
import { NavigationGuardLink } from '@/components/navigation-guard-link';
import { usePathname } from 'next/navigation';
import { SchedulerActiveJobsPoller, SchedulerActiveStatus } from '@/components/scheduler-active-status';
import { ThemeToggle } from '@/components/theme-toggle';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  useSidebar,
} from '@/components/ui/sidebar';
import { getNav, type NavItem, type NavLeaf } from '@/routes';
import { cn } from '@/lib/utils';

function isNavActive(url: string, pathname: string) {
  if (url === '#') return false;
  if (url === '/') return pathname === '/';
  return pathname === url || pathname.startsWith(`${url}/`);
}

function navSectionActive(item: NavItem, pathname: string) {
  if (isNavActive(item.url, pathname)) return true;
  return item.items?.some((sub) => isNavActive(sub.url, pathname)) ?? false;
}

function leafActive(leaf: NavLeaf, pathname: string) {
  return isNavActive(leaf.url, pathname);
}

function SidebarNavFromConfig({ navMain }: { navMain: readonly NavItem[] }) {
  const pathname = usePathname();

  return (
    <SidebarMenu className="gap-1">
      {navMain.map((item) => {
        const Icon = item.icon;

        if (!item.items?.length) {
          const active = isNavActive(item.url, pathname);
          return (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                render={
                  <NavigationGuardLink href={item.url}>
                    <Icon aria-hidden />
                    <span>{item.title}</span>
                  </NavigationGuardLink>
                }
                isActive={active}
                tooltip={item.title}
              />
            </SidebarMenuItem>
          );
        }

        const sectionActive = navSectionActive(item, pathname);

        return (
          <SidebarMenuItem key={item.title}>
            <SidebarMenuButton
              render={
                <NavigationGuardLink href={item.url}>
                  <Icon aria-hidden />
                  <span>{item.title}</span>
                </NavigationGuardLink>
              }
              isActive={sectionActive}
              tooltip={item.title}
            />
            <SidebarMenuSub className="mt-1">
              {item.items.map((sub) => {
                const SubIcon = sub.icon;
                const subActive = leafActive(sub, pathname);
                return (
                  <SidebarMenuSubItem key={sub.url}>
                    <SidebarMenuSubButton
                      render={
                        <NavigationGuardLink href={sub.url}>
                          <SubIcon aria-hidden />
                          <span>{sub.title}</span>
                        </NavigationGuardLink>
                      }
                      isActive={subActive}
                    />
                  </SidebarMenuSubItem>
                );
              })}
            </SidebarMenuSub>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

function AppSidebar() {
  const { state, isMobile } = useSidebar();
  const collapsed = !isMobile && state === 'collapsed';
  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader
        className={cn(
          'flex h-14 shrink-0 flex-row items-center border-b border-sidebar-border px-2',
          collapsed && 'hidden',
        )}
      >
        <span className="min-w-0 flex-1 truncate px-2 text-sm font-semibold">quant-agent</span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <nav aria-label="主导航">
              <SidebarNavFromConfig navMain={getNav()} />
            </nav>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter
        className={cn(
          'mt-auto shrink-0 flex-col gap-1 border-t border-sidebar-border py-2',
          collapsed ? 'items-center px-0' : 'items-stretch px-2',
        )}
      >
        <SchedulerActiveJobsPoller />
        <SchedulerActiveStatus />
        <div className={cn('flex shrink-0', collapsed ? 'justify-center' : 'justify-end')}>
          <ThemeToggle />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <NavigationEditGuardProvider>
      <SidebarProvider
        className="flex min-h-0 min-w-0 flex-1 h-screen w-screen overflow-hidden"
        style={
          {
            '--sidebar-width': '14rem',
            '--sidebar-width-icon': '3.5rem',
          } as React.CSSProperties
        }
      >
        <AppSidebar />
        <NavigationEditGuardDialog />
        <SidebarInset className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-auto">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </NavigationEditGuardProvider>
  );
}
