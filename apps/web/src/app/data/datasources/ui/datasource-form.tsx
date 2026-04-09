"use client";

import type { Dispatch, FormEvent, SetStateAction } from "react";
import { useMemo } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Page } from "@/components/page";
import { PageFormHeaderActions } from "@/components/page-form-header-actions";

import { FactorEditPageTitle } from "@/features/factors/ui/factor-edit-page-title";
import type { DatasourcePluginPublic } from "@/lib/quant-agent-api";
import type { EditorMode, FormState } from "../form-model";
import { DatasourceFormPluginConfig } from "./datasource-form-plugin-config";
import { FormSection } from "./form-section";

export const DATASOURCE_MAIN_FORM_ID = "datasource-main-form";

const DATASOURCE_TYPE_ITEMS: Record<string, string> = {
  sql: "SQL 表",
  csv: "CSV 文件",
};

type Props = {
  editorMode: EditorMode;
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;
  plugins: DatasourcePluginPublic[];
  formError: string | null;
  submitting: boolean;
  onSubmit: (e: FormEvent) => void;
  cancelHref: string;
};

export function DatasourceForm({
  editorMode,
  form,
  setForm,
  plugins,
  formError,
  submitting,
  onSubmit,
  cancelHref,
}: Props) {
  const set = (patch: Partial<FormState>) =>
    setForm((f) => ({ ...f, ...patch }));
  const typeItems = useMemo(
    () =>
      Object.fromEntries(
        plugins.map((p) => [p.type, p.title || DATASOURCE_TYPE_ITEMS[p.type] || p.type]),
      ),
    [plugins],
  );
  const selectedPlugin = plugins.find((p) => p.type === form.type) ?? null;

  return (
    <Page
      gap="none"
      title={
        <FactorEditPageTitle
          name={form.name}
          onNameChange={(n) => set({ name: n })}
          nameAriaLabel="数据源显示名称"
        />
      }
      description={
        editorMode === "create"
          ? "连接信息保存在服务端 workspace；接口不会返回密码明文。"
          : "密码留空表示保留原值。"
      }
      headerClassName="mb-8"
      action={
        <PageFormHeaderActions
          formId={DATASOURCE_MAIN_FORM_ID}
          submitting={submitting}
          submitDisabled={!form.name.trim()}
          cancelHref={cancelHref}
        />
      }
    >
      <form
        id={DATASOURCE_MAIN_FORM_ID}
        className="flex flex-col gap-6"
        onSubmit={(e) => void onSubmit(e)}
      >
        <div className="space-y-4">
          {editorMode === "create" && (
            <div className="grid gap-2">
              <Label htmlFor="ds-type">类型</Label>
              <Select
                modal={false}
                items={typeItems}
                value={form.type}
                onValueChange={(v) =>
                  set({
                    type: v,
                    config: {},
                  })
                }
              >
                <SelectTrigger id="ds-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {plugins.map((p) => (
                    <SelectItem key={p.type} value={p.type}>
                      {p.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <FormSection title="基本设置">
            <div className="flex flex-wrap gap-8 pt-1">
              <Label
                htmlFor="ds-enabled"
                className="flex cursor-pointer items-center gap-2 font-normal"
              >
                <Switch
                  id="ds-enabled"
                  checked={form.enabled}
                  onCheckedChange={(v) => set({ enabled: v })}
                />
                <span className="text-sm font-medium">启用</span>
              </Label>
            </div>
          </FormSection>

          <DatasourceFormPluginConfig
            form={form}
            setForm={setForm}
            plugin={selectedPlugin}
          />

          {formError && (
            <Alert variant="destructive">
              <AlertTitle>校验失败</AlertTitle>
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}
        </div>

      </form>
    </Page>
  );
}
