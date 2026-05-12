import type { DataSourcePublic } from '@/models/datasource/dto';

export type EditorMode = 'create' | 'edit';

export type ColumnMapRow = {
  factor: string;
  column: string;
  enabled: boolean;
};

export type FormState = {
  name: string;
  type: string;
  config: Record<string, unknown>;
};

export function emptyForm(): FormState {
  return {
    name: '',
    type: '',
    config: {},
  };
}

export function hydrateFormFromDataSource(ds: DataSourcePublic): FormState {
  return {
    name: ds.name,
    type: String(ds.type),
    config: dictLikeOrEmpty(ds.config),
  };
}

function dictLikeOrEmpty(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  return v as Record<string, unknown>;
}
