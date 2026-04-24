import { atom } from 'jotai';
import { atomFamily } from 'jotai-family';

import { listNodes } from '@/api/nodes';
import { toAsyncValueStateAtom } from '@/lib/loadable';
import type { NodeSummaryPublic } from './dto';

const nodesListRevisionAtom = atom(0);

const nodesListAsyncAtom = atom(async (get): Promise<NodeSummaryPublic[]> => {
  get(nodesListRevisionAtom);
  return await listNodes();
});

const nodesListAsyncStateAtom = toAsyncValueStateAtom(nodesListAsyncAtom);

export const nodesListAtom = atom((get): NodeSummaryPublic[] | null => {
  const state = get(nodesListAsyncStateAtom);
  return state.value;
});

export const refreshNodesListAtom = atom(null, (_get, set) => {
  set(nodesListRevisionAtom, (v) => v + 1);
});

export const refreshNodesByDomainAtomFamily = atomFamily((domain: string) =>
  atom(null, async () => {
    return await listNodes(domain);
  }),
);
