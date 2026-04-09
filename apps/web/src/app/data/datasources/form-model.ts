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
    type: "",
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
