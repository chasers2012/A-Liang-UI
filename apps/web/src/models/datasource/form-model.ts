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

const WRITE_KEYS = ['write_enabled'] as const;

function dictLikeOrEmpty(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  return v as Record<string, unknown>;
}

export function emptyForm(): FormState {
  return {
    name: '',
    type: '',
    config: { connection: {}, columns: {} },
  };
}

export function hydrateFormFromDataSource(ds: DataSourcePublic): FormState {
  const c = dictLikeOrEmpty(ds.config);
  const connection = dictLikeOrEmpty(c.connection);
  const columns = dictLikeOrEmpty(c.columns);
  const legacyWrite = dictLikeOrEmpty(c.write);
  for (const k of WRITE_KEYS) {
    const fromTop = legacyWrite[k];
    const fromCol = columns[k];
    if (connection[k] === undefined) {
      if (fromTop !== undefined) connection[k] = fromTop;
      else if (fromCol !== undefined) connection[k] = fromCol;
    }
  }
  return {
    name: ds.name,
    type: String(ds.type),
    config: {
      connection,
      columns,
    },
  };
}
