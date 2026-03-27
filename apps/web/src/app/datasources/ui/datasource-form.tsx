"use client";

import type { Dispatch, FormEvent, SetStateAction } from "react";

import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { cn } from "@/lib/utils";
import type { DataSourceType, SqlPublic } from "@/lib/quant-agent-api";

import type { EditorMode, FormState } from "../form-model";
import { DatasourceFormCsv } from "./datasource-form-csv";
import { DatasourceFormSql } from "./datasource-form-sql";
import { FormSection } from "./form-section";

const DATASOURCE_TYPE_ITEMS: Record<DataSourceType, string> = {
  sql: "SQL 表",
  csv: "CSV 文件",
};

type Props = {
  editorMode: EditorMode;
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;
  editingSql: SqlPublic | undefined;
  /** 编辑模式下传入，用于在密码留空时由服务端合并已保存密码并拉取表列 */
  editingDatasourceId?: string | null;
  formError: string | null;
  submitting: boolean;
  onSubmit: (e: FormEvent) => void;
  cancelHref: string;
};

export function DatasourceForm({
  editorMode,
  form,
  setForm,
  editingSql,
  editingDatasourceId = null,
  formError,
  submitting,
  onSubmit,
  cancelHref,
}: Props) {
  const set = (patch: Partial<FormState>) =>
    setForm((f) => ({ ...f, ...patch }));

  return (
    <Page gap="none">
      <header className="mb-8 space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          {editorMode === "create" ? "新增数据源" : "编辑数据源"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {editorMode === "create"
            ? "连接信息保存在服务端 workspace；接口不会返回密码明文。"
            : "密码留空表示保留原值。填写主机或库名并保存后，将从旧版整段 URL 迁移为分字段。"}
        </p>
      </header>

      <form
        className="flex flex-col gap-6"
        onSubmit={(e) => void onSubmit(e)}
      >
        <div className="space-y-4">
          {editorMode === "create" && (
            <div className="grid gap-2">
              <Label htmlFor="ds-type">类型</Label>
              <Select
                modal={false}
                items={DATASOURCE_TYPE_ITEMS}
                value={form.type}
                onValueChange={(v) => set({ type: v as DataSourceType })}
              >
                <SelectTrigger id="ds-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sql">SQL 表</SelectItem>
                  <SelectItem value="csv">CSV 文件</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <FormSection title="基本设置">
            <div className="grid gap-2">
              <Label htmlFor="ds-name">显示名称</Label>
              <Input
                id="ds-name"
                required
                value={form.name}
                onChange={(e) => set({ name: e.target.value })}
              />
            </div>
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

          {form.type === "sql" && (
            <DatasourceFormSql
              editorMode={editorMode}
              form={form}
              setForm={setForm}
              editingSql={editingSql}
              editingDatasourceId={editingDatasourceId}
            />
          )}

          {form.type === "csv" && (
            <DatasourceFormCsv form={form} setForm={setForm} />
          )}

          {formError && (
            <Alert variant="destructive">
              <AlertTitle>校验失败</AlertTitle>
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}
        </div>

        <div className="flex flex-wrap gap-2 border-t border-border/60 pt-6">
          <Button type="submit" disabled={submitting}>
            {submitting ? "保存中…" : "保存"}
          </Button>
          <Link
            href={cancelHref}
            className={cn(
              buttonVariants({ variant: "outline" }),
              "inline-flex h-8 items-center justify-center px-2.5",
            )}
          >
            取消
          </Link>
        </div>
      </form>
    </Page>
  );
}
