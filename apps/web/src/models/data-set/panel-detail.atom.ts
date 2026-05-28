import { listDataSets } from '@/api/data-sets';
import { createRefreshableAsyncAtoms } from '@/lib/refreshable-async-atoms';
import type { DataSetPublic } from './dto';

export const dataSetAtoms = createRefreshableAsyncAtoms<DataSetPublic[] | null>({
  initialValue: null,
  fetcher: listDataSets,
});
