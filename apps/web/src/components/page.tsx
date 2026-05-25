'use client';

import type { ReactNode } from 'react';

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
  /** 主内容区宽度：`default` 为 `max-w-7xl` 居中；`full` 铺满可用宽度。 */
  size?: 'default' | 'full';
  /**
   * 主内容区滚动：`auto` 由 Page 外层滚动；`none` 占满剩余高度且不在 Page 层滚动（左右分栏等全高布局）。
   */
  contentScroll?: 'auto' | 'none';
};

export function Page({
  children,
  className,
  title,
  description,
  headerClassName,
  gap = 'lg',
  size = 'default',
  contentScroll = 'auto',
}: PageProps) {
  const isContentScrollLocked = contentScroll === 'none';
  const showPageHeading = !!title || !!description;

  return (
    <div className="flex h-full w-full min-w-0 flex-1 flex-col">
      <div
        className={cn('min-w-0 w-full flex-1', isContentScrollLocked ? 'min-h-0 overflow-hidden' : 'overflow-y-auto')}
      >
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
    </div>
  );
}
