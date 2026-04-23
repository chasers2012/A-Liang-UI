import { atom } from 'jotai';
import { atomFamily } from 'jotai-family';

import { createNode, getNode, patchNode } from '@/api/nodes';
import { refreshNodesListAtom } from '@/models/nodes/list-detail.atom';
import type { NodeDetailPublic } from '@/models/nodes/dto';
import { toAsyncValueStateAtom } from '@/lib/loadable';

/**
 * 参考 `panel-detail.atom.ts`：用 async atom 直接表达「加载结果 + 错误」。
 * loading 状态由 loadable/suspense 侧处理（这里不额外落地 loading atom）。
 */
export const nodesDetailRevisionAtomFamily = atomFamily((key: string) => {
  void key;
  return atom(0);
});

export const nodesDetailAsyncAtomFamily = atomFamily((nodeId: string | null) =>
  atom(async (get): Promise<NodeDetailPublic | null> => {
    get(nodesDetailRevisionAtomFamily(nodeId ?? ''));
    if (!nodeId) return null;
    return await getNode(nodeId);
  }),
);

export const refreshNodesDetailAtomFamily = atomFamily((key: string) =>
  atom(null, (_get, set) => {
    set(nodesDetailRevisionAtomFamily(key), (v) => v + 1);
  }),
);

export const nodesDetailAsyncStateAtomFamily = atomFamily((nodeId: string | null) =>
  toAsyncValueStateAtom(nodesDetailAsyncAtomFamily(nodeId)),
);

export const saveNodesDetailAtomFamily = atomFamily((nodeId: string | null) =>
  atom(
    null,
    async (
      _get,
      set,
      input: { editName: string; editDescription: string; sourceDraft: string; existingId?: string | null },
    ) => {
      try {
        const trimmedName = input.editName.trim();
        const trimmedDescription = input.editDescription.trim();
        const trimmedSource = input.sourceDraft.trim();
        const nextDetail = !input.existingId
          ? await createNode({
              name: trimmedName,
              description: trimmedDescription,
              ...(trimmedSource ? { source: trimmedSource } : {}),
            })
          : await patchNode(input.existingId ?? nodeId ?? '', {
              source: trimmedSource,
            });
        await set(refreshNodesListAtom);
        if (input.existingId) set(nodesDetailRevisionAtomFamily(input.existingId), (v) => v + 1);
        return nextDetail;
      } catch {
        return null;
      }
    },
  ),
);
