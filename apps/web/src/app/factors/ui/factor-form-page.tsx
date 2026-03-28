"use client";

import type { ReactNode } from "react";

import { Page, type PageProps } from "@/components/page";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getQuantAgentApiBase } from "@/lib/quant-agent-api";

export const FACTOR_MAIN_FORM_ID = "factor-main-form";

type FactorFormPageContainerProps = {
  children: ReactNode;
} & Pick<
  PageProps,
  | "title"
  | "description"
  | "headerClassName"
  | "action"
  | "showAppHeaderBack"
>;

export function FactorFormPageContainer({
  children,
  title,
  description,
  headerClassName,
  action,
  showAppHeaderBack,
}: FactorFormPageContainerProps) {
  return (
    <Page
      title={title}
      description={description}
      headerClassName={headerClassName}
      action={action}
      showAppHeaderBack={showAppHeaderBack}
    >
      {children}
    </Page>
  );
}

/** 供 `Page` 的 `description`：因子表单的 workspace 说明。 */
export function factorFormPageDescription(options?: {
  factorNameBadge?: string;
}): ReactNode {
  const factorNameBadge = options?.factorNameBadge;
  const api = getQuantAgentApiBase();
  return (
    <>
      {factorNameBadge != null && factorNameBadge !== "" ? (
        <>
          <span className="font-mono text-xs">{factorNameBadge}</span>
          {" · "}
        </>
      ) : null}
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
    </>
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

/** 仅主体内容；外层由页面用 `FactorFormPageContainer`（`Page`）包裹。 */
export function FactorFormLoading() {
  return <p className="text-sm text-muted-foreground">加载中…</p>;
}
