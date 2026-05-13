'use client';

import * as React from 'react';

import { NavigationEditGuardDialog } from '@/components/navigation-edit-guard-dialog';
import { NavigationEditGuardProvider } from '@/components/navigation-edit-guard-context';
import { NavigationGuardLink } from '@/components/navigation-guard-link';
import { usePathname } from 'next/navigation';
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
import { SIDEBAR_NAV, type SidebarNavLeaf, type SidebarNavMainItem } from '@/lib/app-navigation';
import { cn } from '@/lib/utils';

function isNavActive(url: string, pathname: string) {
  if (url === '#') return false;
  if (url === '/') return pathname === '/';
  return pathname === url || pathname.startsWith(`${url}/`);
}

function navSectionActive(item: SidebarNavMainItem, pathname: string) {
  if (isNavActive(item.url, pathname)) return true;
  return item.items?.some((sub) => isNavActive(sub.url, pathname)) ?? false;
}

function leafActive(leaf: SidebarNavLeaf, pathname: string) {
  return isNavActive(leaf.url, pathname);
}

function SidebarNavFromConfig({ navMain }: { navMain: readonly SidebarNavMainItem[] }) {
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
              <SidebarNavFromConfig navMain={SIDEBAR_NAV} />
            </nav>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter
        className={cn(
          'mt-auto shrink-0 flex-row items-center border-t border-sidebar-border',
          collapsed ? 'justify-center' : 'justify-end',
        )}
      >
        <ThemeToggle />
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
