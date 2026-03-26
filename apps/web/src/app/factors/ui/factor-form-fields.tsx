"use client";

import type { Dispatch, SetStateAction } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import {
  applyFormMetadataToSource,
  parseUserFactorMetadataFromSource,
} from "../factor-metadata-sync";
import type { FactorFormState } from "../form-model";
import { FactorCodeJar } from "./factor-code-jar";

const SYNC_FROM_FORM_FIELDS: (keyof FactorFormState)[] = [
  "name",
  "group",
  "group_label",
  "description",
  "max_window",
  "dependencies_csv",
];

type Props = {
  form: FactorFormState;
  setForm: Dispatch<SetStateAction<FactorFormState>>;
  formError: string | null;
  /** Prefix for input ids to avoid duplicates across routes. */
  idPrefix?: string;
};

export function FactorFormFields({
  form,
  setForm,
  formError,
  idPrefix = "factor",
}: Props) {
  const set = (patch: Partial<FactorFormState>) => {
    setForm((f) => {
      if (Object.prototype.hasOwnProperty.call(patch, "source")) {
        const src = patch.source as string;
        const parsed = parseUserFactorMetadataFromSource(src);
        return { ...f, ...patch, ...parsed };
      }
      const next = { ...f, ...patch };
      const touchesMeta = SYNC_FROM_FORM_FIELDS.some((k) => k in patch);
      if (touchesMeta) {
        next.source = applyFormMetadataToSource(next.source, next);
      }
      return next;
    });
  };

  const pid = (s: string) => `${idPrefix}-${s}`;

  return (
    <div className="space-y-4">
      {formError && (
        <Alert variant="destructive">
          <AlertTitle>无法保存</AlertTitle>
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={pid("name")}>标识 name</Label>
          <Input
            id={pid("name")}
            className="font-mono text-sm"
            value={form.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="my_factor"
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">
            须为合法 Python 标识符；请与源码中{" "}
            <span className="font-mono">UserFactor.name</span> 保持一致（可与代码编辑器双向同步）。
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor={pid("group")}>分组 group</Label>
          <Input
            id={pid("group")}
            className="font-mono text-sm"
            value={form.group}
            onChange={(e) => set({ group: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={pid("group-label")}>分组显示名</Label>
          <Input
            id={pid("group-label")}
            value={form.group_label}
            onChange={(e) => set({ group_label: e.target.value })}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor={pid("desc")}>描述</Label>
        <Textarea
          id={pid("desc")}
          rows={2}
          value={form.description}
          onChange={(e) => set({ description: e.target.value })}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={pid("mw")}>max_window</Label>
          <Input
            id={pid("mw")}
            type="number"
            min={1}
            className="font-mono"
            value={form.max_window}
            onChange={(e) => set({ max_window: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={pid("deps")}>依赖列（逗号分隔）</Label>
          <Input
            id={pid("deps")}
            className="font-mono text-sm"
            value={form.dependencies_csv}
            onChange={(e) => set({ dependencies_csv: e.target.value })}
            placeholder="close, volume"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor={pid("source")}>Python 源码</Label>
        <FactorCodeJar
          id={pid("source")}
          value={form.source}
          onChange={(source) => set({ source })}
        />
      </div>
    </div>
  );
}
