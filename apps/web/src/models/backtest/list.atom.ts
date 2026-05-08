import { listBacktests } from '@/api/backtests';
import { createRefreshableAsyncAtoms } from '@/lib/refreshable-async-atoms';

import type { BacktestRunSummary } from './dto';

export const backtestsListAtoms = createRefreshableAsyncAtoms<BacktestRunSummary[] | null>({
  initialValue: null,
  fetcher: async () => (await listBacktests({ page: 1, pageSize: 10 })).items,
});
