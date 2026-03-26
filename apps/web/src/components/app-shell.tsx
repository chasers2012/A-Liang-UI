"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Bot,
  Database,
  GitBranch,
  LayoutDashboard,
  Library,
  LineChart,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "首页", icon: LayoutDashboard },
  { href: "/factors", label: "因子库", icon: Library },
  { href: "/datasources", label: "数据源", icon: Database },
  { href: "/strategies", label: "策略", icon: GitBranch },
  { href: "/backtest", label: "回测", icon: LineChart },
  { href: "/agent", label: "Agent", icon: Bot },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <aside
        className={cn(
          "flex min-h-0 shrink-0 flex-col self-stretch border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-out",
          collapsed ? "w-14" : "w-56",
        )}
      >
        <div
          className={cn(
            "flex h-14 shrink-0 items-center gap-2 border-b border-sidebar-border px-2",
            collapsed && "justify-center",
          )}
        >
          {!collapsed && (
            <span className="min-w-0 flex-1 truncate px-2 text-sm font-semibold">
              quant-agent
            </span>
          )}
          <ThemeToggle />
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-2" aria-label="主导航">
          {navItems.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors",
                  "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  collapsed && "justify-center px-0",
                  active &&
                    "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="w-full shrink-0 border-t border-sidebar-border p-2">
          <Button
            type="button"
            variant="ghost"
            className="h-9 w-full justify-end hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={() => setCollapsed((c) => !c)}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "展开侧边栏" : "折叠侧边栏"}
          >
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </Button>
        </div>
      </aside>
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto bg-background">
        {children}
      </main>
    </div>
  );
}
