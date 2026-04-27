import { getFactorTemplate } from '@/api/factors';
import { createRefreshableAsyncAtoms } from '@/lib/refreshable-async-atoms';

export const factorTemplateAtoms = createRefreshableAsyncAtoms<string | null>({
  initialValue: null,
  fetcher: getFactorTemplate,
});
