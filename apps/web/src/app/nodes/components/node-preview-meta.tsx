"use client";

import { MarkdownContent } from "@/components/markdown/markdown-content";
import { Item, ItemContent, ItemTitle } from "@/components/ui/item";
import type { WorkflowSocketDefinition } from "@/components/workflow-graph/types";
import type { NodeParamModel } from "@/models/nodes/dto";
import { cn } from "@/lib/utils";

/** 预览侧列表项：标题行拉满宽，类型徽标贴右，且允许多行标题（覆盖 ItemTitle 默认单行截断）。 */
const previewItemTitleClass =
  "!line-clamp-none w-full min-w-0 flex-wrap items-start justify-between gap-x-3 gap-y-1 font-normal";

const previewTypeBadgeClass =
  "shrink-0 rounded-md border border-border/60 bg-muted/45 px-1.5 py-0.5 font-mono text-[10px] font-normal leading-tight text-muted-foreground";

function PreviewTypeBadge({ children }: { children: string }) {
  const t = children.trim();
  if (!t) return null;
  return <code className={previewTypeBadgeClass}>{t}</code>;
}

function RequiredPill({ required }: { required: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium",
        required
          ? "bg-primary/12 text-primary"
          : "bg-muted/80 text-muted-foreground",
      )}
    >
      {required ? "必填" : "可选"}
    </span>
  );
}

function PreviewMarkdownBlock({ content }: { content: string }) {
  return (
    <div className="mt-2.5 border-t border-border/40 pt-2.5">
      <MarkdownContent
        content={content}
        className="text-[11px] leading-relaxed text-muted-foreground"
      />
    </div>
  );
}

export function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="mt-2.5 font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </h4>
  );
}

export function SocketItem({ socket }: { socket: WorkflowSocketDefinition }) {
  return (
    <Item variant="outline" size="xs" className="bg-card/40 shadow-none">
      <ItemContent className="gap-1.5">
        <ItemTitle className={previewItemTitleClass}>
          <span className="min-w-0 wrap-break-word font-medium leading-snug text-foreground">
            {socket.label?.trim() || socket.name}
          </span>
          <PreviewTypeBadge>{socket.value_type}</PreviewTypeBadge>
        </ItemTitle>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-tight text-muted-foreground">
          <RequiredPill required={socket.required} />
          <span
            className="font-mono text-[10px] text-muted-foreground/90"
            title="字段名"
          >
            {socket.name}
          </span>
        </div>
        {socket.description?.trim() ? (
          <PreviewMarkdownBlock content={socket.description.trim()} />
        ) : null}
      </ItemContent>
    </Item>
  );
}

export function ParamItem({ item }: { item: NodeParamModel }) {
  const renderType = item.render_type?.trim() ?? "";
  return (
    <Item variant="outline" size="xs" className="bg-card/40 shadow-none">
      <ItemContent className="gap-1.5">
        <ItemTitle className={previewItemTitleClass}>
          <span className="min-w-0 wrap-break-word font-medium leading-snug text-foreground">
            {item.label?.trim() || item.key}
          </span>
          {renderType ? <PreviewTypeBadge>{renderType}</PreviewTypeBadge> : null}
        </ItemTitle>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-tight text-muted-foreground">
          <PreviewTypeBadge>{item.type}</PreviewTypeBadge>
          <span
            className="font-mono text-[10px] text-muted-foreground/90"
            title="参数键"
          >
            {item.key}
          </span>
        </div>
        {item.description?.trim() ? (
          <PreviewMarkdownBlock content={item.description.trim()} />
        ) : null}
      </ItemContent>
    </Item>
  );
}

