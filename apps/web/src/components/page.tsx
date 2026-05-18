'use client';

import { usePathname, useRouter } from 'next/navigation';
import { memo, useCallback, useMemo, useState, type ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';

import { isTopLevelPath, useAppHeaderBreadcrumbs } from '@/components/app-header-nav';
import { PageAppHeaderContext } from '@/components/page-app-header-context';
import { PageBreadcrumb } from '@/components/page-breadcrumb';
import { Button } from '@/components/ui/button';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

const gapClass = {
  none: '',
  sm: 'gap-4',
  lg: 'gap-8',
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
  /** Vertical gap between flex children: `sm` = 1rem, `lg` = 2rem (列表/分区页默认). */
  gap?: PageGap;
  /** 是否显示顶栏面包屑与返回（默认 true）。 */
  showAppHeader?: boolean;
  /**
   * 顶栏「返回」：未传时可由子树通过 `PageAppHeaderContext` 自动抑制；
   * `true` 强制显示，`false` 强制隐藏（仍须满足面包屑解析出的可返回页条件）。
   * 点击后为浏览器历史后退，不再跳转到固定 href。
   */
  showAppHeaderBack?: boolean;
  /** 顶栏右侧操作区（如保存/取消），与面包屑、返回同一行。 */
  action?: ReactNode;
  /** 主内容区宽度：`default` 为 `max-w-7xl` 居中；`full` 铺满可用宽度。 */
  size?: 'default' | 'full';
  /**
   * 主内容区滚动：`auto` 由 Page 外层滚动；`none` 占满剩余高度且不在 Page 层滚动（左右分栏等全高布局）。
   */
  contentScroll?: 'auto' | 'none';
};

const PageAppHeader = memo(function PageAppHeader({
  showBackLink,
  action,
  pageHeaderLabel,
}: {
  showBackLink: boolean;
  action?: ReactNode;
  pageHeaderLabel?: string;
}) {
  const router = useRouter();
  const crumbs = useAppHeaderBreadcrumbs();
  const headerCrumbs = useMemo(() => {
    if (!pageHeaderLabel) return crumbs;
    if (crumbs.length === 0) return crumbs;
    const last = crumbs[crumbs.length - 1];
    return [...crumbs.slice(0, -1), { ...last, label: pageHeaderLabel, href: undefined }];
  }, [crumbs, pageHeaderLabel]);

  return (
    <header
      className="flex min-h-14 shrink-0 flex-wrap items-center gap-3 border-b border-border bg-sidebar px-3 py-2"
      role="banner"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <SidebarTrigger className="shrink-0" />
        <PageBreadcrumb items={headerCrumbs} variant="header" />
      </div>
      {showBackLink ? (
        <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={() => router.back()}>
          <ArrowLeft className="size-4" aria-hidden />
          返回
        </Button>
      ) : null}
      {action != null ? (
        <div className="ml-auto flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-2">{action}</div>
      ) : null}
    </header>
  );
});

function resolveShowAppHeaderBackLink(
  canHeaderBack: boolean,
  showAppHeaderBack: boolean | undefined,
  backLinkSuppressedByAction: boolean,
) {
  if (!canHeaderBack) return false;
  if (showAppHeaderBack === true) return true;
  if (showAppHeaderBack === false) return false;
  return !backLinkSuppressedByAction;
}

function PageMainContent({
  children,
  className,
  title,
  description,
  headerClassName,
  gap,
  size,
  contentScroll,
}: Pick<
  PageProps,
  'children' | 'className' | 'title' | 'description' | 'headerClassName' | 'gap' | 'size' | 'contentScroll'
>) {
  const isContentScrollLocked = contentScroll === 'none';
  const showPageHeading = !!title || !!description;

  return (
    <div className={cn('min-w-0 w-full flex-1', isContentScrollLocked ? 'min-h-0 overflow-hidden' : 'overflow-y-auto')}>
      <div
        className={cn(
          'mx-auto flex min-w-0 w-full flex-col p-4',
          size === 'full' ? 'max-w-none' : 'max-w-7xl',
          gapClass[gap ?? 'lg'],
          isContentScrollLocked ? 'min-h-0 h-full' : 'min-h-full',
          className,
        )}
      >
        {showPageHeading ? (
          <header className={cn('mt-4 shrink-0 space-y-2', headerClassName)}>
            {title != null ? <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1> : null}
            {description != null ? (
              <div className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</div>
            ) : null}
          </header>
        ) : null}
        {children}
      </div>
    </div>
  );
}

export function Page({
  children,
  className,
  title,
  description,
  headerClassName,
  gap = 'lg',
  size = 'default',
  contentScroll = 'auto',
  showAppHeader = true,
  showAppHeaderBack,
  action,
}: PageProps) {
  const pathname = usePathname();
  const canHeaderBack = !isTopLevelPath(pathname);
  const pageHeaderLabel = typeof title === 'string' ? title : undefined;

  const [backLinkSuppressedByAction, setBackLinkSuppressedByAction] = useState(false);
  const suppressBackLink = useCallback((suppress: boolean) => {
    setBackLinkSuppressedByAction(suppress);
  }, []);

  const headerContextValue = useMemo(() => ({ suppressBackLink }), [suppressBackLink]);

  const showBackLink = resolveShowAppHeaderBackLink(canHeaderBack, showAppHeaderBack, backLinkSuppressedByAction);

  return (
    <PageAppHeaderContext.Provider value={headerContextValue}>
      <div className="flex h-full w-full min-w-0 flex-1 flex-col">
        {showAppHeader ? (
          <PageAppHeader showBackLink={showBackLink} action={action} pageHeaderLabel={pageHeaderLabel} />
        ) : null}
        <PageMainContent
          className={className}
          title={title}
          description={description}
          headerClassName={headerClassName}
          gap={gap}
          size={size}
          contentScroll={contentScroll}
        >
          {children}
        </PageMainContent>
      </div>
    </PageAppHeaderContext.Provider>
  );
}
