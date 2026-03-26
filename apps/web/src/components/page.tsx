import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const gapClass = {
  none: "",
  sm: "gap-4",
  lg: "gap-8",
} as const;

export type PageGap = keyof typeof gapClass;

export type PageProps = {
  children: ReactNode;
  className?: string;
  /** Vertical gap between flex children: `sm` = 1rem, `lg` = 2rem (列表/分区页默认). */
  gap?: PageGap;
  /** 占满 AppShell 主列剩余高度（`flex-1`）。错误块等可不拉伸。 */
  grow?: boolean;
};

/** 全站主内容区：与因子库列表一致 `max-w-7xl` + `p-6 md:p-8` + 横向居中。 */
export function Page({
  children,
  className,
  gap = "lg",
  grow = true,
}: PageProps) {
  return (
    <div
      className={cn(
        "mx-auto flex min-h-0 min-w-0 w-full max-w-7xl flex-col p-6 md:p-8",
        grow && "flex-1",
        gapClass[gap],
        className,
      )}
    >
      {children}
    </div>
  );
}
