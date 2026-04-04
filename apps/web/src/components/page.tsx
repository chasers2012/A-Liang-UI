"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useState, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

import {
  buildAppHeaderBreadcrumbs,
  headerBackHref,
} from "@/components/app-header-nav";
import { PageAppHeaderContext } from "@/components/page-app-header-context";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
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
  /** 标题下的说明区（`div`），可为纯文本、表单控件或块级结构。 */
  description?: ReactNode;
  /** 传给页面主内容区标题块 `<header>` 的 class（例如 `gap="none"` 时用 `mb-8` 与正文拉开间距）。 */
  headerClassName?: string;
  /**
   * 主内容区占满侧栏剩余高度，子级可用 `flex-1 min-h-0` 撑满；正文区不再整体滚动，
   * 由子组件内部滚动（如全屏对话）。
   */
  fillHeight?: boolean;
  /** Vertical gap between flex children: `sm` = 1rem, `lg` = 2rem (列表/分区页默认). */
  gap?: PageGap;
  /** 是否显示顶栏面包屑与返回（默认 true）。 */
  showAppHeader?: boolean;
  /**
   * 顶栏「返回」：未传时由子树（如带 `cancelHref` 的 `PageFormHeaderActions`）自动抑制；
   * `true` 强制显示，`false` 强制隐藏（仍须满足面包屑解析出的可返回页条件）。
   * 点击后为浏览器历史后退，不再跳转到固定 href。
   */
  showAppHeaderBack?: boolean;
  /** 顶栏右侧操作区（如保存/取消），与面包屑、返回同一行。 */
  action?: ReactNode;
};

type PageChromeProps = PageProps & { pathname: string };

type PagePrimaryColumnProps = {
  fillHeight: boolean;
  gap: PageGap;
  className?: string;
  showPageHeading: boolean;
  title?: ReactNode;
  description?: ReactNode;
  headerClassName?: string;
  children?: ReactNode;
};

function PagePrimaryColumn({
  fillHeight,
  gap,
  className,
  showPageHeading,
  title,
  description,
  headerClassName,
  children,
}: PagePrimaryColumnProps) {
  return (
    <div
      className={cn(
        "mx-auto flex min-h-0 min-w-0 w-full max-w-7xl flex-1 flex-col p-6 md:p-8",
        fillHeight ? "overflow-hidden" : "overflow-y-auto",
        gapClass[gap],
        className,
      )}
    >
      {showPageHeading ? (
        <header className={cn("shrink-0 space-y-2", headerClassName)}>
          {title != null ? (
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              {title}
            </h1>
          ) : null}
          {description != null ? (
            <div className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {description}
            </div>
          ) : null}
        </header>
      ) : null}
      {fillHeight && children != null ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
      ) : (
        children
      )}
    </div>
  );
}

/** `key={pathname}` 挂载时重置「返回」抑制状态，避免 effect 内 setState。 */
function PageChrome({
  pathname,
  children,
  className,
  title,
  description,
  headerClassName,
  fillHeight = false,
  gap = "lg",
  showAppHeader = true,
  showAppHeaderBack,
  action,
}: PageChromeProps) {
  const router = useRouter();
  const headerCrumbs = buildAppHeaderBreadcrumbs(pathname);
  const canHeaderBack = headerBackHref(pathname) != null;
  const showPageHeading = title != null || description != null;

  const [backLinkSuppressedByAction, setBackLinkSuppressedByAction] =
    useState(false);
  const suppressBackLink = useCallback((suppress: boolean) => {
    setBackLinkSuppressedByAction(suppress);
  }, []);

  const showBackLink =
    canHeaderBack &&
    (showAppHeaderBack === true ||
      (showAppHeaderBack !== false && !backLinkSuppressedByAction));

  return (
    <PageAppHeaderContext.Provider value={{ suppressBackLink }}>
      <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col">
        {showAppHeader ? (
          <header
            className="flex min-h-14 shrink-0 flex-wrap items-center gap-3 border-b border-border bg-sidebar px-3 py-2"
            role="banner"
          >
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <SidebarTrigger className="shrink-0" />
              <PageBreadcrumb items={headerCrumbs} variant="header" />
            </div>
            {showBackLink ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 gap-1.5"
                onClick={() => router.back()}
              >
                <ArrowLeft className="size-4" aria-hidden />
                返回
              </Button>
            ) : null}
            {action != null ? (
              <div className="ml-auto flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-2">
                {action}
              </div>
            ) : null}
          </header>
        ) : null}

        <PagePrimaryColumn
          fillHeight={fillHeight}
          gap={gap}
          className={className}
          showPageHeading={showPageHeading}
          title={title}
          description={description}
          headerClassName={headerClassName}
        >
          {children}
        </PagePrimaryColumn>
      </div>
    </PageAppHeaderContext.Provider>
  );
}

/** 全站主内容区：固定顶栏 + 下方主内容区内部纵向滚动（`max-w-7xl` + `p-6 md:p-8`）。 */
export function Page(props: PageProps) {
  const pathname = usePathname();
  return <PageChrome key={pathname} pathname={pathname} {...props} />;
}
