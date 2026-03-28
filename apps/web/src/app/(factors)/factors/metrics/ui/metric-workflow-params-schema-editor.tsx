"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  MetricWorkflowParamSpec,
  MetricWorkflowParamType,
} from "@/models/evaluation-metric/dto";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const TYPE_ITEMS: { value: MetricWorkflowParamType; label: string }[] = [
  { value: "number", label: "数值" },
  { value: "boolean", label: "布尔" },
  { value: "enum", label: "枚举（字符串）" },
  { value: "string", label: "字符串" },
];

function emptyRow(): MetricWorkflowParamSpec {
  return {
    key: "",
    label: "",
    type: "number",
    default: null,
    minimum: null,
    maximum: null,
    enum_values: [],
  };
}

export function MetricWorkflowParamsSchemaEditor(props: {
  value: MetricWorkflowParamSpec[];
  onChange: (next: MetricWorkflowParamSpec[]) => void;
  disabled?: boolean;
}) {
  const { value, onChange, disabled } = props;

  const updateRow = (index: number, patch: Partial<MetricWorkflowParamSpec>) => {
    const next = value.map((row, i) => (i === index ? { ...row, ...patch } : row));
    onChange(next);
  };

  const removeRow = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div>
        <Label>工作流参数</Label>
        <p className="mt-1 text-xs text-muted-foreground">
          定义后可在评价方案画布上为该指标节点设置参数，运行评价时会以 kwargs
          传入 <span className="font-mono">evaluate</span>（保留名{" "}
          <span className="font-mono">quantiles</span>、
          <span className="font-mono">clean_factor</span> 不可用）。
        </p>
      </div>
      <div className="space-y-4">
        {value.map((row, index) => (
          <div
            key={index}
            className="rounded-lg border border-border/60 bg-muted/10 p-3 space-y-3"
          >
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label className="text-xs">参数名（Python）</Label>
                <Input
                  className="h-8 font-mono text-xs"
                  value={row.key}
                  disabled={disabled}
                  onChange={(e) => updateRow(index, { key: e.target.value })}
                  placeholder="e.g. window"
                />
              </div>
              <div className="min-w-[8rem] flex-1 space-y-1">
                <Label className="text-xs">显示标签</Label>
                <Input
                  className="h-8 text-xs"
                  value={row.label}
                  disabled={disabled}
                  onChange={(e) => updateRow(index, { label: e.target.value })}
                  placeholder="可选，默认同参数名"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">类型</Label>
                <Select
                  value={row.type}
                  disabled={disabled}
                  onValueChange={(v) => {
                    if (
                      v === "number" ||
                      v === "boolean" ||
                      v === "enum" ||
                      v === "string"
                    ) {
                      updateRow(index, {
                        type: v,
                        default:
                          v === "boolean"
                            ? false
                            : v === "string"
                              ? ""
                              : null,
                        enum_values: v === "enum" ? row.enum_values : [],
                        minimum: v === "number" ? row.minimum : null,
                        maximum: v === "number" ? row.maximum : null,
                      });
                    }
                  }}
                >
                  <SelectTrigger className="h-8 w-[9rem] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPE_ITEMS.map((it) => (
                      <SelectItem key={it.value} value={it.value}>
                        {it.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 shrink-0 text-destructive"
                disabled={disabled}
                onClick={() => removeRow(index)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
            {row.type === "number" ? (
              <div className="flex flex-wrap gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">默认值</Label>
                  <Input
                    className="h-8 w-28 font-mono text-xs"
                    type="number"
                    disabled={disabled}
                    value={
                      row.default === null || row.default === undefined
                        ? ""
                        : String(row.default)
                    }
                    onChange={(e) => {
                      const s = e.target.value.trim();
                      updateRow(index, {
                        default: s === "" ? null : Number(s),
                      });
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">最小</Label>
                  <Input
                    className="h-8 w-24 font-mono text-xs"
                    type="number"
                    disabled={disabled}
                    value={
                      row.minimum === null || row.minimum === undefined
                        ? ""
                        : String(row.minimum)
                    }
                    onChange={(e) => {
                      const s = e.target.value.trim();
                      updateRow(index, {
                        minimum: s === "" ? null : Number(s),
                      });
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">最大</Label>
                  <Input
                    className="h-8 w-24 font-mono text-xs"
                    type="number"
                    disabled={disabled}
                    value={
                      row.maximum === null || row.maximum === undefined
                        ? ""
                        : String(row.maximum)
                    }
                    onChange={(e) => {
                      const s = e.target.value.trim();
                      updateRow(index, {
                        maximum: s === "" ? null : Number(s),
                      });
                    }}
                  />
                </div>
              </div>
            ) : null}
            {row.type === "boolean" ? (
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 rounded border-input"
                  disabled={disabled}
                  checked={Boolean(row.default)}
                  onChange={(e) =>
                    updateRow(index, { default: e.target.checked })
                  }
                />
                <span>默认勾选（true）</span>
              </label>
            ) : null}
            {row.type === "enum" ? (
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label className="text-xs">可选值（每行一个）</Label>
                  <Textarea
                    className="min-h-[4rem] font-mono text-xs"
                    disabled={disabled}
                    value={row.enum_values.join("\n")}
                    onChange={(e) =>
                      updateRow(index, {
                        enum_values: e.target.value
                          .split(/\r?\n/)
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">默认值（须为可选值之一）</Label>
                  <Input
                    className="h-8 font-mono text-xs"
                    disabled={disabled}
                    value={
                      row.default === null || row.default === undefined
                        ? ""
                        : String(row.default)
                    }
                    onChange={(e) =>
                      updateRow(index, {
                        default: e.target.value.trim() || null,
                      })
                    }
                  />
                </div>
              </div>
            ) : null}
            {row.type === "string" ? (
              <div className="space-y-1">
                <Label className="text-xs">默认值</Label>
                <Input
                  className="h-8 font-mono text-xs"
                  disabled={disabled}
                  value={
                    row.default === null || row.default === undefined
                      ? ""
                      : String(row.default)
                  }
                  onChange={(e) =>
                    updateRow(index, { default: e.target.value })
                  }
                />
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1"
        disabled={disabled}
        onClick={() => onChange([...value, emptyRow()])}
      >
        <Plus className="size-4" />
        添加参数
      </Button>
    </div>
  );
}
