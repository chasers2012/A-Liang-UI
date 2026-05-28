'use client';

import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai';
import { PanelLeftIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

/** 侧栏是否因外部逻辑收起（与 `CollapsibleSidebar` 的 `collapsed` 同步） */
export const collapsibleSidebarCollapsedAtom = atom(false);

/** 窄屏下侧栏 drawer（Sheet）是否打开 */
export const collapsibleSidebarMobileOpenAtom = atom(false);

const SIDEBAR_WIDTH_CLASS = 'w-[320px]';

/** 覆盖 Sheet 默认的 `data-[side=left]:w-3/4`（须用相同 variant 前缀，否则 twMerge 无法替换） */
const MOBILE_DRAWER_SHEET_CLASS =
  'gap-0 p-0 data-[side=left]:w-full data-[side=left]:max-w-[320px] data-[side=left]:sm:max-w-[320px]';

export type CollapsibleSidebarProps = {
  /** 为 true 时收起侧栏（子树不卸载，保留内部状态） */
  collapsed: boolean;
  children: ReactNode;
  className?: string;
  /** 窄屏 drawer 的无障碍标题 */
  drawerTitle?: string;
};

function SidebarPanel({
  collapsed,
  children,
  layout,
}: {
  collapsed: boolean;
  children: ReactNode;
  layout: 'inline' | 'drawer';
}) {
  return (
    <div
      className={cn(
        'flex h-full min-h-0 flex-col',
        layout === 'drawer' ? 'h-full w-full max-w-none' : SIDEBAR_WIDTH_CLASS,
        collapsed ? 'pointer-events-none' : undefined,
      )}
    >
      {children}
    </div>
  );
}

/**
 * 可收起左侧栏：宽屏用 `grid-template-columns` 平滑收起；窄屏收入左侧 Sheet drawer。
 */
export function CollapsibleSidebar({ collapsed, children, className, drawerTitle = '侧栏' }: CollapsibleSidebarProps) {
  const isMobile = useIsMobile();
  const setCollapsedAtom = useSetAtom(collapsibleSidebarCollapsedAtom);
  const [mobileOpen, setMobileOpen] = useAtom(collapsibleSidebarMobileOpenAtom);

  useEffect(() => {
    setCollapsedAtom(collapsed);
  }, [collapsed, setCollapsedAtom]);

  useEffect(() => {
    if (collapsed) setMobileOpen(false);
  }, [collapsed, setMobileOpen]);

  const closeMobileDrawer = useCallback(() => {
    setMobileOpen(false);
  }, [setMobileOpen]);

  const handleMobilePanelClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      if (target.closest('[role="button"]')) closeMobileDrawer();
    },
    [closeMobileDrawer],
  );

  if (isMobile) {
    if (collapsed) return null;

    return (
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className={MOBILE_DRAWER_SHEET_CLASS} onClick={handleMobilePanelClick}>
          <SheetHeader className="sr-only">
            <SheetTitle>{drawerTitle}</SheetTitle>
            <SheetDescription>侧栏导航与选择</SheetDescription>
          </SheetHeader>
          <SidebarPanel layout="drawer" collapsed={false}>
            {children}
          </SidebarPanel>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <div
      className={cn(
        'grid min-h-0 shrink-0 transition-[grid-template-columns,margin] duration-300 ease-in-out motion-reduce:transition-none',
        collapsed ? 'grid-cols-[0fr] -me-4' : 'grid-cols-[1fr] me-0',
        className,
      )}
      aria-hidden={collapsed || undefined}
    >
      <div className="min-h-0 min-w-0 overflow-hidden">
        <SidebarPanel layout="inline" collapsed={collapsed}>
          {children}
        </SidebarPanel>
      </div>
    </div>
  );
}

export type CollapsibleSidebarDrawerTriggerProps = {
  className?: string;
  /** 无障碍标签，默认「打开侧栏」 */
  label?: string;
};

/** 窄屏下打开左侧侧栏 drawer；宽屏或侧栏已收起时不渲染。 */
export function CollapsibleSidebarDrawerTrigger({
  className,
  label = '打开侧栏',
}: CollapsibleSidebarDrawerTriggerProps) {
  const isMobile = useIsMobile();
  const collapsed = useAtomValue(collapsibleSidebarCollapsedAtom);
  const [open, setOpen] = useAtom(collapsibleSidebarMobileOpenAtom);

  if (!isMobile || collapsed) return null;

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      className={cn('shrink-0', className)}
      aria-label={label}
      aria-expanded={open}
      onClick={() => setOpen(true)}
    >
      <PanelLeftIcon className="size-4" />
    </Button>
  );
}
