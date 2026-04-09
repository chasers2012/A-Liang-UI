"use client";

import type { Dispatch, SetStateAction } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import type { FormState } from "../form-model";
import { FormSection } from "./form-section";

type Props = {
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;
};

export function DatasourceFormCsv({ form, setForm }: Props) {
  const set = (patch: Partial<FormState>) =>
    setForm((f) => ({ ...f, ...patch }));

  return (
    <FormSection
      title="CSV 文件"
      description="路径可为绝对路径，或相对于 workspace 根目录的相对路径。"
    >
      <div className="grid gap-2">
        <Label htmlFor="ds-csvpath">文件路径</Label>
        <Input
          id="ds-csvpath"
          required
          value={form.csv_path}
          onChange={(e) => set({ csv_path: e.target.value })}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="ds-kw">read_csv_kwargs（JSON）</Label>
        <Textarea
          id="ds-kw"
          className="min-h-[88px] font-mono text-xs leading-relaxed"
          value={form.read_csv_kwargs_json}
          onChange={(e) => set({ read_csv_kwargs_json: e.target.value })}
        />
      </div>
    </FormSection>
  );
}
