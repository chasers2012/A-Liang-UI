"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { NodeParamModel } from "@/models/evaluation-metric/dto";

export function workflowNodeParamEffectiveValue(
  params: Record<string, unknown>,
  spec: NodeParamModel,
): unknown {
  if (Object.prototype.hasOwnProperty.call(params, spec.key)) {
    return params[spec.key];
  }
  return spec.default;
}

function BooleanParamRow(props: {
  label: string;
  readOnly: boolean;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const { label, readOnly, value, onChange } = props;
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs">
      <input
        type="checkbox"
        className="size-3.5 rounded border-input"
        disabled={readOnly}
        checked={Boolean(value)}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

function StringParamRow(props: {
  label: string;
  readOnly: boolean;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const { label, readOnly, value, onChange } = props;
  const s =
    value === null || value === undefined ? "" : String(value);
  return (
    <div className="space-y-0.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="text"
        disabled={readOnly}
        className="h-7 font-mono text-xs"
        value={s}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function NumberParamRow(props: {
  label: string;
  spec: NodeParamModel;
  readOnly: boolean;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const { label, spec, readOnly, value, onChange } = props;
  const numStr =
    value === null || value === undefined || value === ""
      ? ""
      : String(value);
  return (
    <div className="space-y-0.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number"
        disabled={readOnly}
        className="h-7 font-mono text-xs"
        value={numStr}
        min={spec.minimum ?? undefined}
        max={spec.maximum ?? undefined}
        step="any"
        onChange={(e) => {
          const s = e.target.value.trim();
          if (s === "" || s === "-") onChange(undefined);
          else onChange(Number(s));
        }}
      />
    </div>
  );
}

export function WorkflowNodeParamFieldRow(props: {
  spec: NodeParamModel;
  value: unknown;
  readOnly: boolean;
  onChange: (v: unknown) => void;
}) {
  const { spec, value, readOnly, onChange } = props;
  const label = spec.label?.trim() || spec.key;

  if (spec.type === "boolean") {
    return (
      <BooleanParamRow
        label={label}
        readOnly={readOnly}
        value={value}
        onChange={onChange}
      />
    );
  }
  if (spec.type === "string") {
    return (
      <StringParamRow
        label={label}
        readOnly={readOnly}
        value={value}
        onChange={onChange}
      />
    );
  }
  return (
    <NumberParamRow
      label={label}
      spec={spec}
      readOnly={readOnly}
      value={value}
      onChange={onChange}
    />
  );
}
