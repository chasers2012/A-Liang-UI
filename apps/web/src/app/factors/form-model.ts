import type { FactorDetailPublic } from "@/lib/quant-agent-api";

export type FactorFormState = {
  name: string;
  group: string;
  group_label: string;
  description: string;
  max_window: string;
  dependencies_csv: string;
  source: string;
};

/** Initial shell; `source` is filled from GET /factors/default-source on the new-factor page. */
export function emptyForm(): FactorFormState {
  return {
    name: "my_factor",
    group: "custom",
    group_label: "自定义",
    description: "在此实现 calc",
    max_window: "2",
    dependencies_csv: "close",
    source: "",
  };
}

export function hydrateFromDetail(d: FactorDetailPublic): FactorFormState {
  return {
    name: d.name,
    group: d.group,
    group_label: d.group_label,
    description: d.description,
    max_window: String(d.max_window),
    dependencies_csv: d.dependencies.join(", "),
    source: d.source,
  };
}

export function parseDependencies(csv: string): string[] {
  return csv
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function validateFormForSubmit(form: FactorFormState): string | null {
  if (!form.name.trim()) return "因子标识（name）不能为空";
  const mw = Number.parseInt(form.max_window, 10);
  if (!Number.isFinite(mw) || mw < 1) return "max_window 须为 >= 1 的整数";
  const deps = parseDependencies(form.dependencies_csv);
  if (deps.length === 0) return "至少填写一个依赖字段（如 close）";
  if (!form.source.trim()) return "源码不能为空";
  return null;
}

export function bodyFromForm(form: FactorFormState): Record<string, unknown> {
  const deps = parseDependencies(form.dependencies_csv);
  const max_window = Number.parseInt(form.max_window, 10);
  return {
    name: form.name.trim(),
    group: form.group.trim() || "factor",
    group_label: form.group_label.trim() || "因子",
    description: form.description.trim(),
    max_window,
    dependencies: deps,
    source: form.source,
  };
}
