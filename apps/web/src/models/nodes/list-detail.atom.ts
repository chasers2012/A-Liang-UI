import { atom } from "jotai";
import { atomFamily } from "jotai-family";

import { getNode, listNodes } from "@/api/nodes";
import type { NodeDetailPublic, NodeSummaryPublic } from "./dto";

export type NodesListState = {
  items: NodeSummaryPublic[] | null;
  error: string | null;
};

export const nodesListAtom = atom<NodesListState>({
  items: null,
  error: null,
});

export const refreshNodesListAtom = atom(null, async (_get, set) => {
  set(nodesListAtom, (s) => ({ ...s, error: null }));
  try {
    const items = await listNodes();
    set(nodesListAtom, { items, error: null });
  } catch (e) {
    set(nodesListAtom, {
      items: null,
      error: e instanceof Error ? e.message : String(e),
    });
  }
});

export type NodeDetailState = {
  row: NodeDetailPublic | null;
  error: string | null;
};

export const nodeDetailAtomFamily = atomFamily((id: string) => {
  void id;
  return atom<NodeDetailState>({ row: null, error: null });
});

export const loadNodeDetailAtomFamily = atomFamily((id: string) =>
  atom(null, async (_get, set) => {
    if (!id) return;
    set(nodeDetailAtomFamily(id), { row: null, error: null });
    try {
      const row = await getNode(id);
      set(nodeDetailAtomFamily(id), { row, error: null });
    } catch (e) {
      set(nodeDetailAtomFamily(id), {
        row: null,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }),
);

