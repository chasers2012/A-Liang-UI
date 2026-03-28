"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ArrowUp, ChevronRight, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, postAgentChat } from "@/lib/quant-agent-api";
import { cn } from "@/lib/utils";
import type { AgentChatMessagePublic } from "@/models";

interface ChatTurn extends AgentChatMessagePublic {
  id: string;
}

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** 仅用于界面展示的示例轮次，不会随真实对话发给接口 */
const EXAMPLE_CHAT_TURNS: ChatTurn[] = [
  {
    id: "example-user-welcome",
    role: "user",
    content: "欢迎使用 quant-agent",
  },
  {
    id: "example-assistant-welcome",
    role: "assistant",
    content:
      "你好，欢迎使用 quant-agent 。你可以问我量化、因子或一般技术问题；需要改模型或 API 时请打开「Agent → 配置」。",
  },
  {
    id: "example-user-1",
    role: "user",
    content: "什么是动量因子？",
  },
  {
    id: "example-assistant-1",
    role: "assistant",
    content:
      "动量因子通常用过去一段窗口内的累计收益或相对强度衡量，假设「强者恒强」会在中短期延续。实务上要注意回看期、调仓频率与交易成本，并检验在不同市场阶段的稳定性。",
  },
  {
    id: "example-user-2",
    role: "user",
    content: "因子怎么做行业中性化？",
  },
  {
    id: "example-assistant-2",
    role: "assistant",
    content:
      "常见做法是在每个截面上对因子暴露按行业虚拟变量或行业均值做回归/分组减均值，用残差或相对行业的偏离作为中性化后的因子值；也可结合市值、风格因子一并回归，视研究设定而定。",
  },
];

function isUiOnlyChatMessage(m: ChatTurn): boolean {
  return m.id.startsWith("example-");
}

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
  scrollRef: React.RefObject<HTMLDivElement | null>;
  messages: ChatTurn[];
  isSending: boolean;
}

function AiChatMessageList({
  scrollRef,
  messages,
  isSending,
}: AiChatMessageListProps) {
  const segments = buildChatSegments(messages);

  return (
    <ScrollArea
      viewportRef={scrollRef}
      className="min-h-0 flex-1 "
      role="log"
      aria-live="polite"
      aria-relevant="additions"
    >
      <div className="flex w-full min-w-0 flex-col gap-3 p-4">
        {segments.map((seg, index) => {
          if (seg.kind === "solo-assistant") {
            return (
              <div
                key={seg.message.id}
                className="mr-auto max-w-[min(100%,36rem)] rounded-lg border border-border/70 bg-card px-4 py-3 text-sm leading-relaxed text-card-foreground"
              >
                <span className="sr-only">助手：</span>
                <p className="whitespace-pre-wrap wrap-break-word">
                  {seg.message.content}
                </p>
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
                <div className="border-border/40 border-l py-2 pl-5 pr-2 text-sm leading-relaxed text-foreground">
                  {seg.assistant ? (
                    <>
                      <span className="sr-only">助手：</span>
                      <p className="whitespace-pre-wrap wrap-break-word">
                        {seg.assistant.content}
                      </p>
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
      </div>
    </ScrollArea>
  );
}

interface AiChatComposerProps {
  input: string;
  isSending: boolean;
  onInputChange: (value: string) => void;
  onSend: () => void;
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
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatTurn[]>(() => [
    ...EXAMPLE_CHAT_TURNS,
  ]);
  const [isSending, setIsSending] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, isSending]);

  const send = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    setErrorText(null);
    const userTurn: ChatTurn = {
      id: createId(),
      role: "user",
      content: trimmed,
    };
    const historyForApi = [...messages, userTurn].filter(
      (m) => !isUiOnlyChatMessage(m),
    );
    const payload: AgentChatMessagePublic[] =
      historyForApi.length > 0
        ? historyForApi.map(({ role, content }) => ({ role, content }))
        : [{ role: "user", content: trimmed }];

    setMessages((prev) => [...prev, userTurn]);
    setInput("");
    setIsSending(true);

    try {
      const res = await postAgentChat({ messages: payload });
      setMessages((prev) => [
        ...prev,
        { id: createId(), role: "assistant", content: res.content },
      ]);
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.message : "请求失败，请检查 API 与网络。";
      setErrorText(msg);
      setMessages((prev) => prev.filter((m) => m.id !== userTurn.id));
      setInput(trimmed);
    } finally {
      setIsSending(false);
    }
  }, [input, isSending, messages]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
        <AiChatMessageList
          scrollRef={listRef}
          messages={messages}
          isSending={isSending}
        />
        {errorText ? (
          <p className="shrink-0 text-sm text-destructive" role="alert">
            {errorText}
          </p>
        ) : null}
      </div>
      <div className="shrink-0 pt-4">
        <AiChatComposer
          input={input}
          isSending={isSending}
          onInputChange={setInput}
          onSend={send}
        />
      </div>
    </div>
  );
}
