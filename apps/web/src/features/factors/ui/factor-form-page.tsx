"use client";

import type { ReactNode } from "react";

import { Page, type PageProps } from "@/components/page";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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
  | "fillHeight"
  | "gap"
  | "className"
>;

export function FactorFormPageContainer({
  children,
  title,
  description,
  headerClassName,
  action,
  showAppHeaderBack,
  fillHeight,
  gap,
  className,
}: FactorFormPageContainerProps) {
  return (
    <Page
      title={title}
      description={description}
      headerClassName={headerClassName}
      action={action}
      showAppHeaderBack={showAppHeaderBack}
      fillHeight={fillHeight}
      gap={gap}
      className={className}
    >
      {children}
    </Page>
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
