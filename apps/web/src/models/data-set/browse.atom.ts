import { atom } from 'jotai';

import { dataSetAtoms } from '@/models/data-set/panel-detail.atom';

export type DataSetsBrowseState = {
  searchQuery: string;
};

export const dataSetsBrowseStateAtom = atom<DataSetsBrowseState>({
  searchQuery: '',
});

export const setDataSetsSearchQueryAtom = atom(null, (_get, set, searchQuery: string) => {
  set(dataSetsBrowseStateAtom, (s) => ({ ...s, searchQuery }));
});

function dataSetSearchText(row: {
  name: string;
  description: string;
  datasource_bindings: { datasource_name: string; datasource_type: string }[];
}): string {
  const ds = row.datasource_bindings
    .map((b) => [b.datasource_name || '', b.datasource_type || ''].join(' ').trim())
    .filter(Boolean)
    .join(' ');
  return [row.name, row.description || '', ds].join(' ');
}

/** 与节点页 `filteredNodesAtom` 同理：列表筛选只用 jotai，不写 URL */
export const filteredDataSetsAtom = atom((get) => {
  const items = get(dataSetAtoms.valueAtom);
  const { searchQuery } = get(dataSetsBrowseStateAtom);
  if (!items) return null;
  const q = searchQuery.trim().toLowerCase();
  if (!q) return items;
  return items.filter((row) => dataSetSearchText(row).toLowerCase().includes(q));
});
