"use client";

import type { Dispatch, FormEvent, SetStateAction } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Page } from "@/components/page";
import { PageFormHeaderActions } from "@/components/page-form-header-actions";

export const PREPROCESSOR_MAIN_FORM_ID = "preprocessor-main-form";

export type PreprocessorEditorMode = "create" | "edit";

export type PreprocessorFormState = {
  name: string;
  description: string;
  source: string;
};

type Props = {
  editorMode: PreprocessorEditorMode;
  form: PreprocessorFormState;
  setForm: Dispatch<SetStateAction<PreprocessorFormState>>;
  formError: string | null;
  submitting: boolean;
  onSubmit: (e: FormEvent) => void;
  cancelHref: string;
  onLoadTemplate?: () => void;
};

export function PreprocessorForm({
  editorMode,
  form,
  setForm,
  formError,
  submitting,
  onSubmit,
  cancelHref,
  onLoadTemplate,
}: Props) {
  const set = (patch: Partial<PreprocessorFormState>) =>
    setForm((f) => ({ ...f, ...patch }));

  return (
    <Page
      gap="none"
      title={editorMode === "create" ? "新建预处理器" : form.name || "编辑预处理器"}
      description={
        editorMode === "create"
          ? "编写并提交 source 创建预处理器。"
          : form.description || "修改说明与源码；名称为只读。"
      }
      headerClassName="mb-8"
      action={
        <PageFormHeaderActions
          formId={PREPROCESSOR_MAIN_FORM_ID}
          submitting={submitting}
          submitDisabled={!form.source.trim()}
          cancelHref={cancelHref}
        />
      }
    >
      <form
        id={PREPROCESSOR_MAIN_FORM_ID}
        className="space-y-8"
        onSubmit={(e) => void onSubmit(e)}
      >
        {editorMode === "create" ? (
          <Alert>
            <AlertTitle>创建提示</AlertTitle>
            <AlertDescription>
              创建接口仅接收 <code className="font-mono">source</code>。
            </AlertDescription>
          </Alert>
        ) : null}

        {formError ? (
          <Alert variant="destructive">
            <AlertTitle>提交失败</AlertTitle>
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        ) : null}

        {editorMode === "edit" ? (
          <Card>
            <CardHeader>
              <CardTitle>元信息</CardTitle>
              <CardDescription>名称为只读；说明可修改。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label>名称</Label>
                <p className="break-all rounded-md border bg-muted/20 px-3 py-2 font-mono text-xs">
                  {form.name}
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="pre-desc">说明</Label>
                <Textarea
                  id="pre-desc"
                  value={form.description}
                  onChange={(e) => set({ description: e.target.value })}
                  placeholder="（可选）一句话描述用途与输入输出"
                  rows={4}
                  className="min-h-0 resize-y text-sm"
                />
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <CardTitle>源码</CardTitle>
                <CardDescription>保存后服务端会校验语法与可加载性。</CardDescription>
              </div>
              {onLoadTemplate ? (
                <Button type="button" variant="outline" size="sm" onClick={onLoadTemplate}>
                  插入模板
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="pre-src">source</Label>
              <Textarea
                id="pre-src"
                value={form.source}
                onChange={(e) => set({ source: e.target.value })}
                placeholder="粘贴或编写预处理器源码"
                rows={18}
                className="min-h-0 resize-y font-mono text-xs"
                required
              />
            </div>
          </CardContent>
        </Card>
      </form>
    </Page>
  );
}

