import { atom } from 'jotai';
import { atomFamily } from 'jotai-family';

import { getDatasourceDependencyFields } from '@/api/datasources';
import { toAsyncValueStateAtom } from '@/lib/loadable';
import { dataSetEditorStateAtom } from '@/models/data-set/editor/form-state.atom';
import { selectedDataSetDetailAtom } from '@/models/data-set/detail.atom';

export const datasourceDependencyFieldsRevisionAtomFamily = atomFamily((key: string) => {
  void key;
  return atom(0);
});

export const datasourceDependencyFieldsAsyncAtomFamily = atomFamily((datasourceId: string | null) =>
  atom(async (get): Promise<string[]> => {
    get(datasourceDependencyFieldsRevisionAtomFamily(datasourceId ?? ''));
    const id = (datasourceId ?? '').trim();
    if (!id) return [];
    const r = await getDatasourceDependencyFields(id);
    return (r.fields ?? []).map((x: unknown) => String(x)).filter(Boolean);
  }),
);

export const datasourceDependencyFieldsAsyncStateAtomFamily = atomFamily((datasourceId: string | null) =>
  toAsyncValueStateAtom(datasourceDependencyFieldsAsyncAtomFamily(datasourceId)),
);

export const refreshDatasourceDependencyFieldsAtomFamily = atomFamily((key: string) =>
  atom(null, (_get, set) => {
    set(datasourceDependencyFieldsRevisionAtomFamily(key), (v) => v + 1);
  }),
);

export const selectedDataSetDependencyFieldsByDsIdAsyncAtom = atom(async (get): Promise<Record<string, string[]>> => {
  const row = get(selectedDataSetDetailAtom);
  if (!row) return {};
  const ids = [...new Set(row.datasource_bindings.map((b) => b.datasource_id.trim()).filter(Boolean))];
  const entries = await Promise.all(
    ids.map(async (id) => [id, await get(datasourceDependencyFieldsAsyncAtomFamily(id))] as const),
  );
  return Object.fromEntries(entries);
});

export const selectedDataSetDependencyFieldsByDsIdAsyncStateAtom = toAsyncValueStateAtom(
  selectedDataSetDependencyFieldsByDsIdAsyncAtom,
);

export const editorDependencyFieldsByDsIdAsyncAtom = atom(async (get): Promise<Record<string, string[]>> => {
  const { form } = get(dataSetEditorStateAtom);
  const ids = [...new Set(form.bindings.map((b) => b.datasource_id.trim()).filter(Boolean))];
  const entries = await Promise.all(
    ids.map(async (id) => [id, await get(datasourceDependencyFieldsAsyncAtomFamily(id))] as const),
  );
  return Object.fromEntries(entries);
});

export const editorDependencyFieldsByDsIdAsyncStateAtom = toAsyncValueStateAtom(editorDependencyFieldsByDsIdAsyncAtom);
