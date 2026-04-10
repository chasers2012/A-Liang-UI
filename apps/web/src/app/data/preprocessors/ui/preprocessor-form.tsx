"use client";

import type { Dispatch, FormEvent, SetStateAction } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Page } from "@/components/page";
import { PageFormHeaderActions } from "@/components/page-form-header-actions";
import { FactorCodeJar } from "@/components/factors/ui/factor-code-jar";
import { FactorEditPageDescription } from "@/components/factors/ui/factor-edit-page-description";
import { FactorEditPageTitle } from "@/components/factors/ui/factor-edit-page-title";

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
  templateLoading?: boolean;
  templateError?: string | null;
};

function applyNameToWorkflowNodeLabel(src: string, label: string) {
  const escaped = label.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return src.replace(
    /(@workflow_node\([\s\S]*?\blabel=")([^"]*)(")/,
    (_, prefix: string, _oldLabel: string, suffix: string) => {
      return `${prefix}${escaped}${suffix}`;
    },
  );
}

export function PreprocessorForm({
  editorMode,
  form,
  setForm,
  formError,
  submitting,
  onSubmit,
  cancelHref,
  templateLoading = false,
  templateError = null,
}: Props) {
  const set = (patch: Partial<PreprocessorFormState>) =>
    setForm((f) => ({ ...f, ...patch }));

  return (
    <Page
      title={
        <FactorEditPageTitle
          name={form.name}
          onNameChange={(name) => {
            const trimmed = name.trim();
            setForm((f) => ({
              ...f,
              name,
              source: trimmed
                ? applyNameToWorkflowNodeLabel(f.source, trimmed)
                : f.source,
            }));
          }}
          nameAriaLabel="预处理器名称"
        />
      }
      description={
        <FactorEditPageDescription
          description={form.description}
          onDescriptionChange={(description) => set({ description })}
          descriptionAriaLabel="预处理器描述"
        />
      }
      action={
        <PageFormHeaderActions
          formId={PREPROCESSOR_MAIN_FORM_ID}
          submitting={submitting}
          submitDisabled={!form.source.trim()}
          submitLabel={editorMode === "create" ? "创建" : "保存"}
          submittingLabel={editorMode === "create" ? "创建中…" : "保存中…"}
          cancelHref={cancelHref}
        />
      }
    >
      <form
        id={PREPROCESSOR_MAIN_FORM_ID}
        className="flex flex-col gap-6"
        onSubmit={(e) => void onSubmit(e)}
      >
        {templateError && (
          <Alert variant="destructive">
            <AlertTitle>无法加载模板</AlertTitle>
            <AlertDescription>{templateError}</AlertDescription>
          </Alert>
        )}

        {formError && (
          <Alert variant="destructive">
            <AlertTitle>无法保存</AlertTitle>
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label>源码</Label>
          {templateLoading && (
            <div className="text-sm text-muted-foreground">正在加载源码模板…</div>
          )}
          <FactorCodeJar
            id={
              editorMode === "create"
                ? "new-preprocessor-source"
                : "edit-preprocessor-source"
            }
            value={form.source}
            onChange={(source) => set({ source })}
          />
        </div>
      </form>
    </Page>
  );
}

