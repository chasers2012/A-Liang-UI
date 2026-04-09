"use client";

import type { Dispatch, SetStateAction } from "react";

import type { DatasourcePluginPublic } from "@/lib/quant-agent-api";
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
import { Textarea } from "@/components/ui/textarea";

import type { FormState } from "../form-model";
import { FormSection } from "./form-section";

type Props = {
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;
  plugin: DatasourcePluginPublic | null;
};

type FieldRenderProps = {
  field: DatasourcePluginPublic["fields"][number];
  value: unknown;
  setConfigValue: (key: string, value: unknown) => void;
};

function FieldHelp({ helpText }: { helpText: string | null }) {
  if (!helpText) return null;
  return <p className="text-xs text-muted-foreground">{helpText}</p>;
}

function FieldLabel({
  field,
  htmlFor,
}: {
  field: DatasourcePluginPublic["fields"][number];
  htmlFor: string;
}) {
  return (
    <Label htmlFor={htmlFor}>
      {field.label}
      {field.required ? " *" : ""}
    </Label>
  );
}

function renderBooleanField({ field, value, setConfigValue }: FieldRenderProps) {
  const id = `ds-config-${field.key}`;
  return (
    <div key={field.key} className="grid gap-2">
      <FieldLabel field={field} htmlFor={id} />
      <Label htmlFor={id} className="flex cursor-pointer items-center gap-2 font-normal">
        <Switch
          id={id}
          checked={Boolean(value)}
          onCheckedChange={(v) => setConfigValue(field.key, v)}
        />
        <span className="text-sm font-medium">{Boolean(value) ? "开启" : "关闭"}</span>
      </Label>
      <FieldHelp helpText={field.help_text} />
    </div>
  );
}

function renderSelectField({ field, value, setConfigValue }: FieldRenderProps) {
  const id = `ds-config-${field.key}`;
  const options = field.options ?? [];
  const selected = typeof value === "string" ? value : "";
  return (
    <div key={field.key} className="grid gap-2">
      <FieldLabel field={field} htmlFor={id} />
      <Select
        modal={false}
        items={Object.fromEntries(options.map((i) => [i.value, i.label]))}
        value={selected}
        onValueChange={(v) => setConfigValue(field.key, v)}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldHelp helpText={field.help_text} />
    </div>
  );
}

function parseJsonOrKeepString(raw: string): unknown {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return raw;
    }
    return parsed;
  } catch {
    return raw;
  }
}

function renderJsonField({ field, value, setConfigValue }: FieldRenderProps) {
  const id = `ds-config-${field.key}`;
  const jsonText =
    typeof value === "string" ? value : JSON.stringify(value ?? {}, null, 2);
  return (
    <div key={field.key} className="grid gap-2">
      <FieldLabel field={field} htmlFor={id} />
      <Textarea
        id={id}
        className="min-h-[88px] font-mono text-xs leading-relaxed"
        placeholder={field.placeholder ?? "{}"}
        value={jsonText}
        onChange={(e) => setConfigValue(field.key, parseJsonOrKeepString(e.target.value))}
      />
      <FieldHelp helpText={field.help_text} />
    </div>
  );
}

function renderTextLikeField({ field, value, setConfigValue }: FieldRenderProps) {
  const id = `ds-config-${field.key}`;
  return (
    <div key={field.key} className="grid gap-2">
      <FieldLabel field={field} htmlFor={id} />
      <Input
        id={id}
        required={field.required}
        type={field.kind === "password" ? "password" : "text"}
        inputMode={field.kind === "number" ? "numeric" : undefined}
        placeholder={field.placeholder ?? undefined}
        value={value == null ? "" : String(value)}
        onChange={(e) => {
          const raw = e.target.value;
          if (field.kind === "number") {
            const t = raw.trim();
            setConfigValue(field.key, t ? Number(t) : null);
            return;
          }
          setConfigValue(field.key, raw);
        }}
      />
      <FieldHelp helpText={field.help_text} />
    </div>
  );
}

function renderField(props: FieldRenderProps) {
  const { field } = props;
  if (field.kind === "boolean") return renderBooleanField(props);
  if (field.kind === "select") return renderSelectField(props);
  if (field.kind === "json") return renderJsonField(props);
  return renderTextLikeField(props);
}

export function DatasourceFormPluginConfig({ form, setForm, plugin }: Props) {
  const setConfigValue = (key: string, value: unknown) =>
    setForm((f) => ({ ...f, config: { ...f.config, [key]: value } }));

  if (!plugin) return null;

  return (
    <FormSection title={plugin.title} description={plugin.description ?? undefined}>
      {plugin.fields.map((field) =>
        renderField({
          field,
          value: form.config[field.key],
          setConfigValue,
        }),
      )}
    </FormSection>
  );
}
