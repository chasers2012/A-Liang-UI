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
    config: { connection: {}, columns: {}, write: {} },
  };
}

export function hydrateFormFromDataSource(ds: DataSourcePublic): FormState {
  const c = dictLikeOrEmpty(ds.config);
  const connection = dictLikeOrEmpty(c.connection);
  const columns = dictLikeOrEmpty(c.columns);
  const write = dictLikeOrEmpty(c.write);
  for (const k of WRITE_KEYS) {
    if (write[k] !== undefined) continue;
    const fromConn = connection[k];
    const fromCol = columns[k];
    if (fromConn !== undefined) write[k] = fromConn;
    else if (fromCol !== undefined) write[k] = fromCol;
    delete connection[k];
    delete columns[k];
  }
  return {
    name: ds.name,
    type: String(ds.type),
    config: {
      connection,
      columns,
      write,
    },
  };
}
