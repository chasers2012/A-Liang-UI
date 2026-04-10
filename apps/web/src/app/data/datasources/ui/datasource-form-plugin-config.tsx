"use client";

import type { ChangeEvent, Dispatch, SetStateAction } from "react";
import { useRef, useState } from "react";

import {
  ApiError,
  type DatasourcePluginPublic,
  uploadDatasourceFile,
} from "@/lib/quant-agent-api";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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

type UploadStatusView = {
  Icon: typeof Loader2 | typeof AlertCircle | typeof CheckCircle2 | null;
  className: string;
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

function BooleanField({ field, value, setConfigValue }: FieldRenderProps) {
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

function SelectField({ field, value, setConfigValue }: FieldRenderProps) {
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

function toUploadErrorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return "文件上传失败";
}

function resolveUploadStatusView(
  uploading: boolean,
  uploadError: string | null,
  showName: string,
): UploadStatusView {
  if (uploading) {
    return {
      Icon: Loader2,
      className: "size-4 shrink-0 animate-spin text-muted-foreground",
    };
  }
  if (uploadError) {
    return {
      Icon: AlertCircle,
      className: "size-4 shrink-0 text-destructive",
    };
  }
  if (showName) {
    return {
      Icon: CheckCircle2,
      className: "size-4 shrink-0 text-emerald-600",
    };
  }
  return {
    Icon: null,
    className: "size-4 shrink-0",
  };
}

function JsonField({ field, value, setConfigValue }: FieldRenderProps) {
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

function FileField({
  field,
  value,
  setConfigValue,
}: Pick<FieldRenderProps, "field" | "value" | "setConfigValue">) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pickedName, setPickedName] = useState<string>("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const id = `ds-config-${field.key}`;
  const accept = (field.file_types ?? []).join(",");
  const uploadedPath = typeof value === "string" ? value : "";
  const uploadedName = uploadedPath ? uploadedPath.split("/").pop() ?? uploadedPath : "";
  const showName = uploading ? pickedName : pickedName || uploadedName;
  const { Icon: StatusIcon, className: statusClassName } = resolveUploadStatusView(
    uploading,
    uploadError,
    showName,
  );
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (!picked) return;
    setPickedName(picked.name);
    setUploadError(null);
    setUploading(true);
    void uploadDatasourceFile(picked)
      .then((resp) => {
        setConfigValue(field.key, resp.path);
      })
      .catch((err: unknown) => {
        setUploadError(toUploadErrorMessage(err));
      })
      .finally(() => {
        setUploading(false);
      });
  };
  return (
    <div key={field.key} className="grid gap-2">
      <FieldLabel field={field} htmlFor={id} />
      <Input
        ref={inputRef}
        id={id}
        required={field.required}
        type="file"
        accept={accept || undefined}
        disabled={uploading}
        className="sr-only"
        onChange={handleFileChange}
      />
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? "上传中..." : "选择文件"}
        </Button>
        <span className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
          {StatusIcon && <StatusIcon className={statusClassName} aria-hidden="true" />}
          <span className="min-w-0 truncate" role="status" aria-live="polite">
            {showName || "未选择文件"}
          </span>
        </span>
      </div>
      {uploadError && (
        <p className="text-xs text-destructive" role="alert">
          {uploadError}
        </p>
      )}
      <FieldHelp helpText={field.help_text} />
    </div>
  );
}

function TextLikeField({ field, value, setConfigValue }: FieldRenderProps) {
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

function Field(props: FieldRenderProps) {
  const { field } = props;
  if (field.kind === "boolean") return <BooleanField {...props} />;
  if (field.kind === "select") return <SelectField {...props} />;
  if (field.kind === "json") return <JsonField {...props} />;
  if (field.kind === "file") return <FileField  {...props} />;
  return <TextLikeField {...props} />;
}

export function DatasourceFormPluginConfig({ form, setForm, plugin }: Props) {
  const setConfigValue = (key: string, value: unknown) =>
    setForm((f) => ({ ...f, config: { ...f.config, [key]: value } }));

  if (!plugin) return null;

  return (
    <FormSection title={plugin.title} description={plugin.description ?? undefined}>
      {plugin.fields.map((field) =>
      (
        <Field
          key={field.key}
          field={field}
          value={form.config[field.key]}
          setConfigValue={setConfigValue}
        />
      ),
      )}
    </FormSection>
  );
}
