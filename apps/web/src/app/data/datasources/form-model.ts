import type { DataSourcePublic } from "@/lib/quant-agent-api";

export type EditorMode = "create" | "edit";

export type ColumnMapRow = {
  factor: string;
  column: string;
  enabled: boolean;
};

export type FormState = {
  name: string;
  type: string;
  enabled: boolean;
  config: Record<string, unknown>;
};

export function emptyForm(): FormState {
  return {
    name: "",
    type: "sql",
    enabled: true,
    config: {},
  };
}

export function hydrateFormFromDataSource(ds: DataSourcePublic): FormState {
  return {
    name: ds.name,
    type: String(ds.type),
    enabled: ds.enabled,
    config: dictLikeOrEmpty(ds.config),
  };
}

function dictLikeOrEmpty(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  return v as Record<string, unknown>;
}

export function parseOptionalPort(s: string): number | undefined {
  const t = s.trim();
  if (!t) return undefined;
  const n = parseInt(t, 10);
  if (Number.isNaN(n) || n < 1 || n > 65535) {
    throw new Error("端口须为 1–65535 的整数");
  }
  return n;
}
