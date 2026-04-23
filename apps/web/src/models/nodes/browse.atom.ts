import { atom } from 'jotai';

import { listNodeVisibilityConfigs } from '@/api/nodes';
import { toAsyncValueStateAtom } from '@/lib/loadable';
import { nodesListAtom } from '@/models/nodes/list-detail.atom';
import type { NodeSummaryPublic } from '@/models/nodes/dto';

/** 与后端 ``PLUGIN_NODE_SOURCE_SENTINEL`` 一致 */
export const UNCATEGORIZED_KEY = '__uncategorized__';

export type NodesSourceFilter = 'all' | 'user' | 'plugin';

export type NodesBrowseState = {
  searchQuery: string;
  sourceFilter: NodesSourceFilter;
  includedCategories: string[];
};

export const nodesBrowseStateAtom = atom<NodesBrowseState>({
  searchQuery: '',
  sourceFilter: 'all',
  includedCategories: [],
});

export const nodesSelectedDomainsAtom = atom<string[]>([]);
export const nodesSelectedIdAtom = atom<string | null>(null);

const nodesDomainConfigsAsyncAtom = atom(async (): Promise<Record<string, Set<string>>> => {
  try {
    const rows = await listNodeVisibilityConfigs();
    const next: Record<string, Set<string>> = {};
    for (const row of rows) {
      next[row.domain] = new Set(row.hidden_node_ids);
    }
    return next;
  } catch {
    return {};
  }
});

const nodesDomainConfigsAsyncStateAtom = toAsyncValueStateAtom(nodesDomainConfigsAsyncAtom);

export const nodesDomainConfigsAtom = atom((get): Record<string, Set<string>> => {
  return get(nodesDomainConfigsAsyncStateAtom).value ?? {};
});

export function parseNodesDetailRouteId(pathname: string): string | null {
  if (pathname === '/nodes/new') return null;
  const detail = /^\/nodes\/([^/]+)$/.exec(pathname);
  if (!detail) return null;
  const id = detail[1];
  if (id === 'new') return null;
  return decodeURIComponent(id);
}

export function categoryKey(m: NodeSummaryPublic): string {
  const c = m.category?.trim();
  return c ? c : UNCATEGORIZED_KEY;
}

export function categoryLabel(key: string): string {
  return key === UNCATEGORIZED_KEY ? '未分类' : key;
}

export const setNodesSearchQueryAtom = atom(null, (_get, set, searchQuery: string) => {
  set(nodesBrowseStateAtom, (s) => ({ ...s, searchQuery }));
});

export const setNodesSourceFilterAtom = atom(null, (_get, set, sourceFilter: NodesSourceFilter) => {
  set(nodesBrowseStateAtom, (s) => ({ ...s, sourceFilter }));
});

export const toggleNodesCategoryFilterAtom = atom(null, (get, set, key: string) => {
  const prev = get(nodesBrowseStateAtom).includedCategories;
  if (prev.length === 0) {
    set(nodesBrowseStateAtom, (s) => ({ ...s, includedCategories: [key] }));
    return;
  }
  if (prev.includes(key)) {
    set(nodesBrowseStateAtom, (s) => ({
      ...s,
      includedCategories: s.includedCategories.filter((v) => v !== key),
    }));
    return;
  }
  set(nodesBrowseStateAtom, (s) => ({
    ...s,
    includedCategories: [...s.includedCategories, key],
  }));
});

export const clearNodesCategoryFiltersAtom = atom(null, (_get, set) => {
  set(nodesBrowseStateAtom, (s) => ({ ...s, includedCategories: [] }));
});

export const resetNodesBrowseFiltersAtom = atom(null, (_get, set) => {
  set(nodesBrowseStateAtom, {
    searchQuery: '',
    sourceFilter: 'all',
    includedCategories: [],
  });
});

export const nodesIncludedCategoriesSetAtom = atom((get) => new Set(get(nodesBrowseStateAtom).includedCategories));

export const nodesCategoryOptionKeysAtom = atom((get) => {
  const items = get(nodesListAtom);
  if (!items?.length) return [];
  const keys = new Set<string>();
  for (const m of items) {
    keys.add(categoryKey(m));
  }
  return [...keys].sort((a, b) => categoryLabel(a).localeCompare(categoryLabel(b), 'zh-Hans-CN'));
});

export const filteredNodesAtom = atom((get) => {
  const items = get(nodesListAtom);
  const { searchQuery, sourceFilter, includedCategories } = get(nodesBrowseStateAtom);
  if (!items) return null;
  const q = searchQuery.trim().toLowerCase();
  const categorySet = new Set(includedCategories);
  return items.filter((m) => {
    if (sourceFilter === 'user' && m.is_plugin) {
      return false;
    }
    if (sourceFilter === 'plugin' && !m.is_plugin) {
      return false;
    }
    if (categorySet.size > 0 && !categorySet.has(categoryKey(m))) {
      return false;
    }
    if (q) {
      const hay = `${m.name}\n${m.description}\n${m.id}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
});

export const nodesFilterPopoverActiveAtom = atom((get) => {
  const { sourceFilter, includedCategories } = get(nodesBrowseStateAtom);
  return sourceFilter !== 'all' || includedCategories.length > 0;
});

export const nodesDefaultSelectedIdAtom = atom((get) => {
  const items = get(filteredNodesAtom);
  return items?.[0]?.id ?? null;
});
