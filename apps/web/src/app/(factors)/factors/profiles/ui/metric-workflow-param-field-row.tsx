"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { NodeParamModel } from "@/models/evaluation-metric/dto";

export function metricWorkflowParamEffectiveValue(
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

function EnumParamRow(props: {
  label: string;
  choices: string[];
  readOnly: boolean;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const { label, choices, readOnly, value, onChange } = props;
  const v =
    value !== null && value !== undefined && value !== ""
      ? String(value)
      : "";
  const current =
    choices.length > 0
      ? choices.includes(v)
        ? v
        : (choices[0] ?? "")
      : "";
  return (
    <div className="space-y-0.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select
        disabled={readOnly || choices.length === 0}
        value={current || "__none__"}
        onValueChange={(x) => {
          if (x !== "__none__") onChange(x);
        }}
      >
        <SelectTrigger className="h-7 font-mono text-xs">
          <SelectValue placeholder="选择" />
        </SelectTrigger>
        <SelectContent>
          {choices.length === 0 ? (
            <SelectItem value="__none__" disabled>
              无可选值
            </SelectItem>
          ) : (
            choices.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
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

export function MetricWorkflowParamFieldRow(props: {
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
  if (spec.type === "enum") {
    return (
      <EnumParamRow
        label={label}
        choices={spec.enum_values ?? []}
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
