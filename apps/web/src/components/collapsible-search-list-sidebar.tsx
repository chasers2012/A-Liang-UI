'use client';

import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export type CollapsibleSearchListSidebarProps = {
  /** 为 true 时收起侧栏（子树不卸载，保留 SearchList 等本地状态） */
  collapsed: boolean;
  /** 展开时侧栏内容区宽度，如 `w-[320px]`、`w-[300px]` */
  innerWidthClassName: string;
  children: ReactNode;
  className?: string;
};

/**
 * 左侧列表侧栏：用 `grid-template-columns` 在 `0fr` / `1fr` 间过渡，实现平滑收起，避免卸载子树。
 */
export function CollapsibleSearchListSidebar({
  collapsed,
  innerWidthClassName,
  children,
  className,
}: CollapsibleSearchListSidebarProps) {
  return (
    <div
      className={cn(
        // 与列表页 `Page gap="sm"`（gap-4）对齐：收起时用负 margin 抵消列间距，避免右侧仍留出一条空缝
        'grid min-h-0 shrink-0 transition-[grid-template-columns,margin] duration-300 ease-in-out motion-reduce:transition-none',
        collapsed ? 'grid-cols-[0fr] -me-4' : 'grid-cols-[1fr] me-0',
        className,
      )}
      aria-hidden={collapsed || undefined}
    >
      <div className="min-h-0 min-w-0 overflow-hidden">
        <div
          className={cn(
            'flex h-full min-h-0 flex-col',
            innerWidthClassName,
            collapsed ? 'pointer-events-none' : undefined,
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
