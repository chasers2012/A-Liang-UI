"use client";

import { useEffect, useRef, useState } from "react";
import { Archive, ChevronLeft, ChevronRight, Pencil, Plus } from "lucide-react";
import { useAtomValue, useSetAtom } from "jotai";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  activeChatSessionIdAtom,
  archiveChatSessionAtom,
  chatSessionsAtom,
  createChatSessionAtom,
  renameChatSessionAtom,
  selectChatSessionAtom,
} from "@/models/chat/session.atom";

interface ChatSessionTabsProps {
  isBusy: boolean;
}

export function ChatSessionTabs({ isBusy }: ChatSessionTabsProps) {
  const sessions = useAtomValue(chatSessionsAtom);
  const activeId = useAtomValue(activeChatSessionIdAtom);
  const createSession = useSetAtom(createChatSessionAtom);
  const selectSession = useSetAtom(selectChatSessionAtom);
  const renameSession = useSetAtom(renameChatSessionAtom);
  const archiveSession = useSetAtom(archiveChatSessionAtom);
  const active = sessions.find((s) => s.id === activeId) ?? null;
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [archiveOpen, setArchiveOpen] = useState(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollButtons = () => {
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
  };

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
  }, [sessions.length]);

  const scrollByTabs = (dir: "left" | "right") => {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = Math.max(180, Math.floor(el.clientWidth * 0.7));
    el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  const submitRename = () => {
    if (!active) return;
    const title = renameValue.trim();
    if (!title) return;
    void renameSession({ sessionId: active.id, title });
    setRenameOpen(false);
  };

  return (
    <div className="flex items-center gap-2 border-b border-border/60 px-3 pt-1">
      <Tabs
        value={activeId ?? ""}
        onValueChange={(v) => {
          if (!v) return;
          void selectSession(v);
        }}
        className="min-w-0 flex-1"
      >
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
                <TabsTrigger
                  key={s.id}
                  value={s.id}
                  disabled={isBusy}
                  className={cn(
                    "inline-flex max-w-64 items-center gap-2 truncate rounded-t-md border border-b-0 px-2.5 py-1 text-[0.82rem] transition-colors outline-none",
                    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                    "aria-selected:border-primary/70 aria-selected:bg-background aria-selected:text-foreground aria-selected:shadow-sm",
                    "data-selected:border-primary/70 data-selected:bg-background data-selected:text-foreground data-selected:shadow-sm",
                  )}
                >
                  <span className="truncate">{s.title}</span>
                  {s.message_count > 0 ? (
                    <span className="text-xs opacity-70">{s.message_count}</span>
                  ) : null}
                </TabsTrigger>
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
      </Tabs>

      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-2 px-2"
          onClick={() => void createSession()}
          disabled={isBusy}
        >
          <Plus className="size-4" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => {
            if (!active) return;
            setRenameValue(active.title);
            setRenameOpen(true);
          }}
          disabled={isBusy || !active}
          aria-label="重命名当前会话"
        >
          <Pencil className="size-4" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => {
            if (!active) return;
            setArchiveOpen(true);
          }}
          disabled={isBusy || !active}
          aria-label="归档当前会话"
        >
          <Archive className="size-4" aria-hidden />
        </Button>
      </div>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent size="md">
          <DialogHeader title="重命名会话" />
          <DialogBody variant="inset">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">请输入新的会话名称。</p>
              <Input
                autoFocus
                value={renameValue}
                onChange={(ev) => setRenameValue(ev.target.value)}
                onKeyDown={(ev) => {
                  if (ev.key !== "Enter") return;
                  ev.preventDefault();
                  submitRename();
                }}
                placeholder="会话名称"
                maxLength={120}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRenameOpen(false)}
            >
              取消
            </Button>
            <Button
              type="button"
              onClick={submitRename}
              disabled={!active || !renameValue.trim()}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title="归档会话"
        description={
          <div className="space-y-2">
            <p className="text-sm text-foreground">确认归档会话「{active?.title ?? ""}」？</p>
            <p className="text-sm text-muted-foreground">
              归档后会从当前列表隐藏，消息会保留；可在「已归档」页面恢复。
            </p>
          </div>
        }
        confirmLabel="归档"
        onConfirm={() => {
          if (!active) return;
          void archiveSession(active.id);
          setArchiveOpen(false);
        }}
      />
    </div>
  );
}
