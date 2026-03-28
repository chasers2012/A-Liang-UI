"use client";

import Link from "next/link";
import { useContext, useLayoutEffect } from "react";

import { PageAppHeaderContext } from "@/components/page-app-header-context";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PageFormHeaderActions({
  formId,
  submitting,
  submitDisabled = false,
  submitLabel = "保存",
  submittingLabel = "保存中…",
  cancelHref,
  cancelLabel = "取消",
}: {
  formId: string;
  submitting: boolean;
  submitDisabled?: boolean;
  submitLabel?: string;
  submittingLabel?: string;
  /** 有取消入口时隐藏顶栏默认「返回」，避免与取消重复。 */
  cancelHref?: string;
  cancelLabel?: string;
}) {
  const chrome = useContext(PageAppHeaderContext);
  useLayoutEffect(() => {
    if (cancelHref == null || chrome == null) return;
    chrome.suppressBackLink(true);
    return () => {
      chrome.suppressBackLink(false);
    };
  }, [cancelHref, chrome]);

  return (
    <>
      {cancelHref != null ? (
        <Link
          href={cancelHref}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          {cancelLabel}
        </Link>
      ) : null}
      <Button
        type="submit"
        form={formId}
        disabled={submitting || submitDisabled}
        size="sm"
      >
        {submitting ? submittingLabel : submitLabel}
      </Button>
    </>
  );
}
