import { atom } from 'jotai';
import { atomFamily } from 'jotai-family';

import { listNodes } from '@/api/nodes';
import { createRefreshableAsyncAtoms } from '@/lib/refreshable-async-atoms';
import type { NodeSummaryPublic } from './dto';

export const nodesListAtoms = createRefreshableAsyncAtoms<NodeSummaryPublic[] | null>({
  initialValue: null,
  fetcher: async () => await listNodes(),
});

export const refreshNodesByDomainAtomFamily = atomFamily((domain: string) =>
  atom(null, async () => {
    return await listNodes(domain);
  }),
);
