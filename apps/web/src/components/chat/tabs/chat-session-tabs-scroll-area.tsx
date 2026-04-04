"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TabsList } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { AgentChatSessionSummaryPublic } from "@/models";

import { ChatSessionTabItem } from "./chat-session-tab-item";

export const ChatSessionTabsScrollArea = memo(function ChatSessionTabsScrollArea({
  sessions,
  isBusy,
}: {
  sessions: AgentChatSessionSummaryPublic[];
  isBusy: boolean;
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollButtons = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }
    const left = el.scrollLeft;
    const maxLeft = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(left > 0);
    setCanScrollRight(maxLeft > 0 && left < maxLeft - 1);
  }, []);

  useEffect(() => {
    queueMicrotask(() => updateScrollButtons());
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => updateScrollButtons();
    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(() => updateScrollButtons());
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, [sessions.length, updateScrollButtons]);

  const scrollByTabs = useCallback(
    (dir: "left" | "right") => {
      const el = scrollerRef.current;
      if (!el) return;
      const amount = Math.max(180, Math.floor(el.clientWidth * 0.7));
      el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
    },
    [],
  );

  return (
    <div className="min-w-0 flex items-stretch gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 shrink-0"
        onClick={() => scrollByTabs("left")}
        disabled={!canScrollLeft}
        aria-label="向左滚动会话"
      >
        <ChevronLeft className="size-4" aria-hidden />
      </Button>

      <div
        ref={scrollerRef}
        className={cn(
          "min-w-0 flex-1 overflow-x-auto overflow-y-hidden",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden items-end justify-end",
        )}
      >
        <TabsList className="flex min-w-max items-end gap-1 pr-1 h-full">
          {sessions.map((s) => (
            <ChatSessionTabItem
              key={s.id}
              id={s.id}
              title={s.title}
              messageCount={s.message_count}
              disabled={isBusy}
            />
          ))}
        </TabsList>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 shrink-0"
        onClick={() => scrollByTabs("right")}
        disabled={!canScrollRight}
        aria-label="向右滚动会话"
      >
        <ChevronRight className="size-4" aria-hidden />
      </Button>
    </div>
  );
});
