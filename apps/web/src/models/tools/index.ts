import { atom } from 'jotai';
import { atomFamily } from 'jotai-family';

import { listTools, setToolAuthorization, type ToolRecord } from '@/api/tools';
import { createRefreshableAsyncAtoms } from '@/lib/refreshable-async-atoms';

export type ToolsCategoryGroup = {
  category: string;
  items: ToolRecord[];
};

function displayCategory(raw: string): string {
  const c = (raw || '').trim();
  if (!c) return 'Other';
  return c;
}

function uniqSorted(items: string[]): string[] {
  return Array.from(new Set(items.map((s) => s.trim()).filter(Boolean))).sort();
}

export const toolsListAtoms = createRefreshableAsyncAtoms<ToolRecord[] | null>({
  initialValue: null,
  fetcher: async () => {
    const data = await listTools();
    return data.slice().sort((a, b) => a.id.localeCompare(b.id));
  },
});

export const toolsCategoryGroupsAtom = atom<ToolsCategoryGroup[]>((get) => {
  const tools = get(toolsListAtoms.valueAtom) ?? [];
  if (!tools.length) return [];

  const categories = uniqSorted(tools.map((t) => displayCategory(t.category)));
  const itemsByCategory = new Map<string, ToolRecord[]>();
  for (const t of tools) {
    const c = displayCategory(t.category);
    const arr = itemsByCategory.get(c);
    if (arr) arr.push(t);
    else itemsByCategory.set(c, [t]);
  }

  return categories.map((category) => {
    const items = (itemsByCategory.get(category) ?? []).slice().sort((a, b) => a.id.localeCompare(b.id));
    return { category, items };
  });
});

export const toolSavingAtomFamily = atomFamily((toolId: string) => {
  void toolId;
  return atom<boolean>(false);
});

export const refreshToolsAtom = atom(null, async (_get, set) => {
  await set(toolsListAtoms.refreshAtom);
});

export const updateToolAuthorizationAtom = atom(
  null,
  async (
    get,
    set,
    payload: {
      toolId: string;
      next: ToolRecord['authorization'];
    },
  ) => {
    const tools = get(toolsListAtoms.valueAtom) ?? [];
    const target = tools.find((item) => item.id === payload.toolId);
    if (!target || target.authorization === payload.next) return;

    const previous = target.authorization;
    set(toolSavingAtomFamily(payload.toolId), true);
    set(toolsListAtoms.valueAtom, (prevList) => {
      if (!prevList) return prevList;
      return prevList.map((item) => (item.id === payload.toolId ? { ...item, authorization: payload.next } : item));
    });
    try {
      await setToolAuthorization(payload.toolId, payload.next);
    } catch {
      set(toolsListAtoms.valueAtom, (prevList) => {
        if (!prevList) return prevList;
        return prevList.map((item) => (item.id === payload.toolId ? { ...item, authorization: previous } : item));
      });
    } finally {
      set(toolSavingAtomFamily(payload.toolId), false);
    }
  },
);
