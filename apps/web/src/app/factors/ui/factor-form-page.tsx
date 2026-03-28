"use client";

import type { ReactNode } from "react";
import Link from "next/link";

import { Page } from "@/components/page";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getQuantAgentApiBase } from "@/lib/quant-agent-api";

export function FactorFormPageContainer({ children }: { children: ReactNode }) {
  return <Page>{children}</Page>;
}

/** 标题区：页面标题 + workspace 说明（面包屑在 Page 顶栏） */
export function FactorFormPageHeader({
  title,
  factorNameBadge,
}: {
  title: string;
  factorNameBadge?: string;
}) {
  const api = getQuantAgentApiBase();
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          {title}
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {factorNameBadge != null && factorNameBadge !== "" && (
            <>
              <span className="font-mono text-xs">
                {factorNameBadge}
              </span>
              {" · "}
            </>
          )}
          元数据写入{" "}
          <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">
            config/factors.json
          </code>
          ，源码保存为{" "}
          <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">
            factors/&lt;id&gt;.py
          </code>
          （相对服务端{" "}
          <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">
            {api}
          </code>{" "}
          使用的 workspace）。
        </p>
      </div>
    </div>
  );
}

export function FactorFormHintAlert({ children }: { children: ReactNode }) {
  return (
    <Alert>
      <AlertTitle>提示</AlertTitle>
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

export function FactorFormSubmitRow({
  submitting,
  cancelHref = "/factors",
  cancelLabel = "取消",
}: {
  submitting: boolean;
  cancelHref?: string;
  cancelLabel?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2 border-t border-border/60 pt-6 justify-end">
      <Link
        href={cancelHref}
        className={cn(buttonVariants({ variant: "outline" }))}
      >
        {cancelLabel}
      </Link>
      <Button type="submit" disabled={submitting}>
        {submitting ? "保存中…" : "保存"}
      </Button>
    </div>
  );
}

export function FactorFormLoadError({ message }: { message: string }) {
  return (
    <FactorFormPageContainer>
      <Alert variant="destructive">
        <AlertTitle>无法加载因子</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </Alert>
    </FactorFormPageContainer>
  );
}

export function FactorFormLoading() {
  return (
    <FactorFormPageContainer>
      <p className="text-sm text-muted-foreground">加载中…</p>
    </FactorFormPageContainer>
  );
}
