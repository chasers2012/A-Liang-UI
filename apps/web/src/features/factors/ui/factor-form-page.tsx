"use client";

import type { ReactNode } from "react";

import { Page } from "@/components/page";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export const FACTOR_MAIN_FORM_ID = "factor-main-form";

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
    <Page>
      <Alert variant="destructive">
        <AlertTitle>无法加载因子</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </Alert>
    </Page>
  );
}

/** 仅主体内容；外层由页面用 `Page`（`Page`）包裹。 */
export function FactorFormLoading() {
  return <p className="text-sm text-muted-foreground">加载中…</p>;
}
