"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

import {
  buildAppHeaderBreadcrumbs,
  headerBackHref,
} from "@/components/app-header-nav";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const gapClass = {
  none: "",
  sm: "gap-4",
  lg: "gap-8",
} as const;

export type PageGap = keyof typeof gapClass;

export type PageProps = {
  children?: ReactNode;
  className?: string;
  /** 页顶主标题（与全站列表页 `h1` 样式一致）。 */
  title?: ReactNode;
  /** 标题下的说明文案，可为纯文本或含行内元素的 ReactNode。 */
  description?: ReactNode;
  /** 传给页面主内容区标题块 `<header>` 的 class（例如 `gap="none"` 时用 `mb-8` 与正文拉开间距）。 */
  headerClassName?: string;
  /** Vertical gap between flex children: `sm` = 1rem, `lg` = 2rem (列表/分区页默认). */
  gap?: PageGap;
  /** 是否显示顶栏面包屑与返回（默认 true）。 */
  showAppHeader?: boolean;
};

/** 全站主内容区：固定顶栏 + 下方主内容区内部纵向滚动（`max-w-7xl` + `p-6 md:p-8`）。 */
export function Page({
  children,
  className,
  title,
  description,
  headerClassName,
  gap = "lg",
  showAppHeader = true,
}: PageProps) {
  const pathname = usePathname();
  const headerCrumbs = buildAppHeaderBreadcrumbs(pathname);
  const backHref = headerBackHref(pathname);
  const showHeader = title != null || description != null;

  return (
    <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col">
      {showAppHeader ? (
        <header
          className="flex min-h-14 shrink-0 flex-wrap items-center gap-3 border-b border-border bg-sidebar px-6 py-2 md:px-8"
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
      ) : null}

      <div
        className={cn(
          "mx-auto flex min-h-0 min-w-0 w-full max-w-7xl flex-1 flex-col overflow-y-auto p-6 md:p-8",
          gapClass[gap],
          className,
        )}
      >
        {showHeader ? (
          <header className={cn("space-y-2", headerClassName)}>
            {title != null ? (
              <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                {title}
              </h1>
            ) : null}
            {description != null ? (
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
            ) : null}
          </header>
        ) : null}
        {children}
      </div>
    </div>
  );
}
