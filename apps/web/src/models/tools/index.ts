import { atom } from 'jotai';
import { atomFamily } from 'jotai-family';

import { listTools, setToolAuthorization, type ToolRecord } from '@/api/tools';
import { toAsyncValueStateAtom } from '@/lib/loadable';

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

const toolsListRevisionAtom = atom(0);
const toolsAuthorizationOverrideAtom = atom<Record<string, ToolRecord['authorization']>>({});

const toolsListAsyncAtom = atom(async (get): Promise<ToolRecord[]> => {
  get(toolsListRevisionAtom);
  const data = await listTools();
  return data.slice().sort((a, b) => a.id.localeCompare(b.id));
});

const toolsListAsyncStateAtom = toAsyncValueStateAtom(toolsListAsyncAtom);

export const toolsListStateAtom = atom((get) => {
  const asyncState = get(toolsListAsyncStateAtom);
  return {
    loading: asyncState.loading,
    error: asyncState.error,
  };
});

export const toolsListAtom = atom<ToolRecord[]>((get) => {
  const asyncState = get(toolsListAsyncStateAtom);
  if (!asyncState.value) return [];

  const overrides = get(toolsAuthorizationOverrideAtom);
  return asyncState.value.map((item) => {
    const override = overrides[item.id];
    return override ? { ...item, authorization: override } : item;
  });
});

export const toolsCategoryGroupsAtom = atom<ToolsCategoryGroup[]>((get) => {
  const tools = get(toolsListAtom);
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

export const refreshToolsAtom = atom(null, async (get, set) => {
  set(toolsAuthorizationOverrideAtom, {});
  set(toolsListRevisionAtom, (v) => v + 1);
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
    const tools = get(toolsListAtom);
    const target = tools.find((item) => item.id === payload.toolId);
    if (!target || target.authorization === payload.next) return;

    const previous = target.authorization;
    set(toolSavingAtomFamily(payload.toolId), true);
    set(toolsAuthorizationOverrideAtom, (prevMap) => ({
      ...prevMap,
      [payload.toolId]: payload.next,
    }));
    try {
      await setToolAuthorization(payload.toolId, payload.next);
    } catch {
      set(toolsAuthorizationOverrideAtom, (prevMap) => ({
        ...prevMap,
        [payload.toolId]: previous,
      }));
    } finally {
      set(toolSavingAtomFamily(payload.toolId), false);
    }
  },
);
