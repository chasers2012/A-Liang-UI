"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  Bot,
  ChevronRight,
  Database,
  GitBranch,
  LayoutDashboard,
  Layers,
  Library,
  LineChart,
  PanelLeftClose,
  PanelLeftOpen,
  Table2,
  TableProperties,
} from "lucide-react";

import {
  buildAppHeaderBreadcrumbs,
  headerBackHref,
} from "@/components/app-header-nav";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { ThemeToggle } from "@/components/theme-toggle";
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
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

function isNavActive(url: string, pathname: string) {
  if (url === "#") return false;
  if (url === "/") return pathname === "/";
  return pathname === url || pathname.startsWith(`${url}/`);
}

export type SidebarNavLeaf = {
  title: string;
  url: string;
  /** 可选；未设置时由当前路径计算高亮 */
  isActive?: boolean;
  icon: LucideIcon;
};

export type SidebarNavMainItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  items?: SidebarNavLeaf[];
};

export const sidebarNav: { navMain: SidebarNavMainItem[] } = {
  navMain: [
    { title: "首页", url: "/", icon: LayoutDashboard },
    {
      title: "因子",
      url: "#",
      icon: Layers,
      items: [
        { title: "因子库", url: "/factors", icon: Library },
        { title: "评价方案", url: "/evaluation-profiles", icon: Table2 },
        { title: "评价指标", url: "/evaluation-metrics", icon: LineChart },
      ],
    },
    {
      title: "数据",
      url: "#",
      icon: TableProperties,
      items: [
        { title: "数据源", url: "/datasources", icon: Database },
        { title: "数据集", url: "/test-sets", icon: Table2 },
      ],
    },
    { title: "策略", url: "/strategies", icon: GitBranch },
    { title: "回测", url: "/backtest", icon: LineChart },
    { title: "Agent", url: "/agent", icon: Bot },
  ],
};

function navSectionActive(item: SidebarNavMainItem, pathname: string) {
  return item.items?.some((sub) => isNavActive(sub.url, pathname)) ?? false;
}

function leafActive(leaf: SidebarNavLeaf, pathname: string) {
  if (leaf.isActive != null) return leaf.isActive;
  return isNavActive(leaf.url, pathname);
}

function SidebarNavFromConfig({ navMain }: { navMain: SidebarNavMainItem[] }) {
  const pathname = usePathname();
  const [idleOpenBySection, setIdleOpenBySection] = useState<
    Record<string, boolean>
  >({});

  const sectionOpen = (item: SidebarNavMainItem) => {
    if (!item.items?.length) return false;
    const active = navSectionActive(item, pathname);
    const idle = idleOpenBySection[item.title] ?? true;
    return active || idle;
  };

  const setSectionOpen = (item: SidebarNavMainItem, open: boolean) => {
    if (navSectionActive(item, pathname)) return;
    setIdleOpenBySection((prev) => ({ ...prev, [item.title]: open }));
  };

  const toggleSection = (item: SidebarNavMainItem) => {
    if (navSectionActive(item, pathname)) return;
    setIdleOpenBySection((prev) => ({
      ...prev,
      [item.title]: !(prev[item.title] ?? true),
    }));
  };

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
                  <Link href={item.url}>
                    <Icon aria-hidden />
                    <span>{item.title}</span>
                  </Link>
                }
                isActive={active}
                tooltip={item.title}
              />
            </SidebarMenuItem>
          );
        }

        const open = sectionOpen(item);
        const sectionActive = navSectionActive(item, pathname);

        return (
          <Collapsible
            key={item.title}
            open={open}
            onOpenChange={(next) => setSectionOpen(item, next)}
          >
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => toggleSection(item)}
                aria-expanded={open}
                render={
                  <button type="button">
                    <Icon className="size-4 shrink-0" aria-hidden />
                    <span>{item.title}</span>
                    <ChevronRight
                      className={cn(
                        "ml-auto size-4 shrink-0 transition-transform duration-200 group-data-[collapsible=icon]:hidden",
                        open && "rotate-90",
                      )}
                      aria-hidden
                    />
                  </button>
                }
                isActive={sectionActive}
                tooltip={item.title}
              />
              <CollapsibleContent>
                <SidebarMenuSub className="mt-1">
                  {item.items.map((sub) => {
                    const SubIcon = sub.icon;
                    const subActive = leafActive(sub, pathname);
                    return (
                      <SidebarMenuSubItem key={sub.url}>
                        <SidebarMenuSubButton
                          render={
                            <Link href={sub.url}>
                              <SubIcon aria-hidden />
                              <span>{sub.title}</span>
                            </Link>
                          }
                          isActive={subActive}
                        />
                      </SidebarMenuSubItem>
                    );
                  })}
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>
        );
      })}
    </SidebarMenu>
  );
}

function AppSidebar() {
  const { toggleSidebar, state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader
        className={cn(
          "flex h-14 shrink-0 flex-row items-center gap-2 border-b border-sidebar-border",
          collapsed ? "justify-center" : "px-2",
        )}
      >
        {!collapsed && (
          <span className="min-w-0 flex-1 truncate px-2 text-sm font-semibold">
            quant-agent
          </span>
        )}
        <ThemeToggle />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <nav aria-label="主导航">
              <SidebarNavFromConfig navMain={sidebarNav.navMain} />
            </nav>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <Button
          type="button"
          variant="ghost"
          className="h-9 w-full justify-end hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          onClick={toggleSidebar}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "展开侧边栏" : "折叠侧边栏"}
        >
          {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const headerCrumbs = buildAppHeaderBreadcrumbs(pathname);
  const backHref = headerBackHref(pathname);

  return (
    <SidebarProvider
      className="flex min-h-0 min-w-0 flex-1 h-screen w-screen overflow-hidden"
      style={
        {
          "--sidebar-width": "14rem",
          "--sidebar-width-icon": "3.5rem",
        } as React.CSSProperties
      }
    >
      <AppSidebar />
      <SidebarInset className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header
          className="flex min-h-14 shrink-0 flex-wrap items-center gap-3 border-b border-border bg-background px-6 py-2 md:px-8"
          role="banner"
        >
          <PageBreadcrumb items={headerCrumbs} variant="header" />
          {backHref != null ? (
            <Link
              href={backHref}
              className={cn(
                buttonVariants({
                  variant: "outline",
                  size: "sm",
                }),
                "shrink-0 gap-1.5",
              )}
            >
              <ArrowLeft className="size-4" aria-hidden />
              返回
            </Link>
          ) : null}
        </header>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
