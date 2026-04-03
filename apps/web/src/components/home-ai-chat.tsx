"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { AiChatMarkdown } from "@/components/ai-chat-markdown";
import { cn } from "@/lib/utils";
import {
  activeChatMessagesAtom,
  activeChatSessionIdAtom,
  chatErrorAtom,
  chatHydratedAtom,
  chatInputAtom,
  chatIsSendingAtom,
  chatSessionsAtom,
  createChatSessionAtom,
  deleteChatSessionAtom,
  hydrateChatStateAtom,
  renameChatSessionAtom,
  selectChatSessionAtom,
  sendChatMessageAtom,
  type ChatTurn,
} from "@/models/chat/session.atom";

type ChatSegment =
  | { kind: "solo-assistant"; message: ChatTurn }
  | { kind: "turn"; user: ChatTurn; assistant: ChatTurn | undefined };

function buildChatSegments(messages: ChatTurn[]): ChatSegment[] {
  const segments: ChatSegment[] = [];
  let i = 0;
  while (i < messages.length) {
    const m = messages[i];
    if (m.role === "user") {
      const next = messages[i + 1];
      if (next?.role === "assistant") {
        segments.push({ kind: "turn", user: m, assistant: next });
        i += 2;
        continue;
      }
      segments.push({ kind: "turn", user: m, assistant: undefined });
      i += 1;
      continue;
    }
    segments.push({ kind: "solo-assistant", message: m });
    i += 1;
  }
  return segments;
}

interface AiChatMessageListProps {
  messages: ChatTurn[];
  isSending: boolean;
}

function AiChatMessages({
  messages,
  isSending,
}: AiChatMessageListProps) {
  const segments = buildChatSegments(messages);

  return (
    <>
      {segments.map((seg, index) => {
        if (seg.kind === "solo-assistant") {
          return (
            <div
              key={seg.message.id}
              className="mr-auto max-w-[min(100%,36rem)] rounded-lg border border-border/70 bg-card py-3 pl-6 pr-4 text-sm leading-relaxed text-card-foreground"
            >
              <span className="sr-only">助手：</span>
              <AiChatMarkdown content={seg.message.content} />
            </div>
          );
        }

        const isLastSegment = index === segments.length - 1;
        const showPending =
          isSending && isLastSegment && seg.assistant === undefined;

        return (
          <Collapsible
            key={seg.user.id}
            defaultOpen
            className="w-full min-w-0"
          >
            <CollapsibleTrigger
              style={{ zIndex: 10 + index }}
              className={cn(
                "sticky top-0 flex w-full min-w-0 items-start gap-2 bg-background pb-2 text-left outline-none",
                "group/trigger rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                "[&[data-panel-open]_svg]:rotate-90",
              )}
            >
              <span className="inline-flex shrink-0 pt-2">
                <ChevronRight
                  className="size-4 shrink-0 text-muted-foreground transition-transform duration-200"
                  aria-hidden
                />
              </span>
              <div
                className={cn(
                  "flex min-w-0 flex-1 overflow-hidden rounded-lg border border-border/70 bg-muted/50 text-sm leading-relaxed text-foreground transition-colors",
                  "group-hover/trigger:bg-muted/70",
                )}
              >
                <span
                  className="w-1 shrink-0 bg-primary"
                  aria-hidden
                />
                <div className="min-w-0 flex-1 px-3 py-2">
                  <span className="sr-only">你：</span>
                  <p className="whitespace-pre-wrap wrap-break-word">
                    {seg.user.content}
                  </p>
                </div>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="border-border/40 border-l py-2 pl-7 pr-2 text-sm leading-relaxed text-foreground">
                {seg.assistant ? (
                  <>
                    <span className="sr-only">助手：</span>
                    {seg.assistant.content === "" &&
                      isSending &&
                      isLastSegment ? (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2
                          className="size-4 shrink-0 animate-spin"
                          aria-hidden
                        />
                        正在生成…
                      </div>
                    ) : null}
                    {seg.assistant.content !== "" ? (
                      <AiChatMarkdown content={seg.assistant.content} />
                    ) : null}
                  </>
                ) : showPending ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                    正在生成…
                  </div>
                ) : null}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </>
  );
}

interface AiChatComposerProps {
  input: string;
  isSending: boolean;
  onInputChange: (value: string) => void;
  onSend: () => void;
}

interface ChatSessionTabsProps {
  isBusy: boolean;
}

function ChatSessionTabs({ isBusy }: ChatSessionTabsProps) {
  const sessions = useAtomValue(chatSessionsAtom);
  const activeId = useAtomValue(activeChatSessionIdAtom);
  const createSession = useSetAtom(createChatSessionAtom);
  const selectSession = useSetAtom(selectChatSessionAtom);
  const renameSession = useSetAtom(renameChatSessionAtom);
  const deleteSession = useSetAtom(deleteChatSessionAtom);
  const active = sessions.find((s) => s.id === activeId) ?? null;
  const [deleteOpen, setDeleteOpen] = useState(false);
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
                    // Base UI Tabs uses aria-selected / data-selected (not data-state).
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
            const title = window.prompt("重命名会话", active.title);
            if (!title || !title.trim()) return;
            void renameSession({ sessionId: active.id, title: title.trim() });
          }}
          disabled={isBusy || !active}
          aria-label="重命名当前会话"
        >
          <Pencil className="size-4" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="icon"
          className="size-8"
          onClick={() => {
            if (!active) return;
            setDeleteOpen(true);
          }}
          disabled={isBusy || !active}
          aria-label="删除当前会话"
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="删除会话"
        description={
          <div className="space-y-2">
            <p className="text-sm text-foreground">
              确认删除会话「{active?.title ?? ""}」？
            </p>
            <p className="text-sm text-muted-foreground">
              删除后将无法恢复，会话内消息会一并移除。
            </p>
          </div>
        }
        confirmLabel="删除"
        confirmVariant="destructive"
        onConfirm={() => {
          if (!active) return;
          void deleteSession(active.id);
          setDeleteOpen(false);
        }}
      />
    </div>
  );
}

function AiChatComposer({
  input,
  isSending,
  onInputChange,
  onSend,
}: AiChatComposerProps) {
  const formId = useId();

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={formId} className="sr-only">
        输入消息
      </label>
      <div className="flex items-start gap-2">
        <Button
          type="button"
          size="icon"
          aria-label="发送"
          onClick={() => void onSend()}
          disabled={isSending || !input.trim()}
        >
          {isSending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <ArrowUp className="size-4" aria-hidden />
          )}
        </Button>
        <Textarea
          id={formId}
          rows={3}
          placeholder="输入消息，Enter 发送，Shift+Enter 换行"
          value={input}
          disabled={isSending}
          onChange={(ev) => onInputChange(ev.target.value)}
          onKeyDown={(ev) => {
            if (ev.key !== "Enter" || ev.shiftKey) return;
            ev.preventDefault();
            void onSend();
          }}
          className="min-h-18 min-w-0 flex-1 resize-y"
        />
      </div>
    </div>
  );
}

export function HomeAiChat() {
  const listRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useAtom(chatInputAtom);
  const messages = useAtomValue(activeChatMessagesAtom);
  const isSending = useAtomValue(chatIsSendingAtom);
  const errorText = useAtomValue(chatErrorAtom);
  const hydrated = useAtomValue(chatHydratedAtom);
  const hydrate = useSetAtom(hydrateChatStateAtom);
  const send = useSetAtom(sendChatMessageAtom);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, isSending]);

  useEffect(() => {
    if (hydrated) return;
    void hydrate();
  }, [hydrate, hydrated]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <ChatSessionTabs isBusy={isSending} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden">
        <ScrollArea
          viewportRef={listRef}
          className="min-h-0 flex-1 pt-2"
          role="log"
          aria-live="polite"
          aria-relevant="additions"
        >
          <div className="flex w-full min-w-0 flex-col gap-3 p-6 pl-9">
            <AiChatMessages
              messages={messages}
              isSending={isSending}
            />
          </div>
        </ScrollArea>
        {errorText ? (
          <p className="shrink-0 px-6 text-sm text-destructive" role="alert">
            {errorText}
          </p>
        ) : null}
        <div className="shrink-0 px-6 pb-6">
          <AiChatComposer
            input={input}
            isSending={isSending}
            onInputChange={setInput}
            onSend={() => void send()}
          />
        </div>
      </div>
    </div>
  );
}
