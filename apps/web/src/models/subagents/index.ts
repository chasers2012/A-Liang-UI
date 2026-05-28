import { atom } from 'jotai';
import { atomFamily } from 'jotai-family';

import {
  listSubagentToolConfigs,
  updateSubagentToolConfig,
  type SubagentToolConfigListResponse,
  type SubagentToolConfigRecord,
} from '@/api/subagents';
import { createRefreshableAsyncAtoms } from '@/lib/refreshable-async-atoms';

export const subagentToolConfigAtoms = createRefreshableAsyncAtoms<SubagentToolConfigListResponse | null>({
  initialValue: null,
  fetcher: async () => await listSubagentToolConfigs(),
});

export const subagentSavingAtomFamily = atomFamily((subagentId: string) => {
  void subagentId;
  return atom<boolean>(false);
});

export const refreshSubagentToolConfigsAtom = atom(null, async (_get, set) => {
  await set(subagentToolConfigAtoms.refreshAtom);
});

function upsertSubagentConfig(
  payload: SubagentToolConfigListResponse | null,
  next: SubagentToolConfigRecord,
): SubagentToolConfigListResponse | null {
  if (!payload) return payload;
  return {
    ...payload,
    subagents: payload.subagents.map((item) => (item.subagent_id === next.subagent_id ? next : item)),
  };
}

export const updateSubagentToolsAtom = atom(
  null,
  async (
    get,
    set,
    payload: {
      subagentId: string;
      toolIds: string[];
    },
  ) => {
    const data = get(subagentToolConfigAtoms.valueAtom);
    const target = data?.subagents.find((item) => item.subagent_id === payload.subagentId);
    if (!target) return;
    const nextToolIds = Array.from(new Set(payload.toolIds.map((item) => item.trim()).filter(Boolean)));
    const previousToolIds = target.tool_ids.slice();
    set(subagentSavingAtomFamily(payload.subagentId), true);
    set(subagentToolConfigAtoms.valueAtom, (prev) => {
      if (!prev) return prev;
      return upsertSubagentConfig(prev, { ...target, tool_ids: nextToolIds });
    });
    try {
      const updated = await updateSubagentToolConfig(payload.subagentId, nextToolIds);
      set(subagentToolConfigAtoms.valueAtom, (prev) => upsertSubagentConfig(prev, updated));
    } catch {
      set(subagentToolConfigAtoms.valueAtom, (prev) =>
        upsertSubagentConfig(prev, { ...target, tool_ids: previousToolIds }),
      );
    } finally {
      set(subagentSavingAtomFamily(payload.subagentId), false);
    }
  },
);
