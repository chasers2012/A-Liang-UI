import { listFactors } from '@/api/factors';
import { createRefreshableAsyncAtoms } from '@/lib/refreshable-async-atoms';
import type { FactorSummaryPublic } from './dto';

export const factorsListAtoms = createRefreshableAsyncAtoms<FactorSummaryPublic[] | null>({
  initialValue: null,
  fetcher: listFactors,
});
