"use client";

import * as React from "react";
import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";

import { cn } from "@/lib/utils";

export interface ScrollAreaProps
  extends Omit<
    React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root>,
    "children"
  > {
  children: React.ReactNode;
  viewportRef?: React.Ref<HTMLDivElement | null>;
  viewportClassName?: string;
}

function ScrollArea({
  className,
  children,
  viewportRef,
  viewportClassName,
  ...props
}: ScrollAreaProps) {
  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={cn("relative h-full min-h-0 w-full overflow-hidden", className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        ref={viewportRef}
        data-slot="scroll-area-viewport"
        className={cn(
          "h-full w-full max-w-full rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
          viewportClassName,
        )}
      >
        <ScrollAreaPrimitive.Content className="min-w-0">
          {children}
        </ScrollAreaPrimitive.Content>
      </ScrollAreaPrimitive.Viewport>
      <ScrollAreaPrimitive.Scrollbar
        orientation="vertical"
        className="m-px flex w-2 touch-none select-none p-px transition-[color] data-hovering:bg-muted/50"
      >
        <ScrollAreaPrimitive.Thumb className="relative flex-1 rounded-full bg-border" />
      </ScrollAreaPrimitive.Scrollbar>
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
}

export { ScrollArea };
