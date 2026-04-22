'use client';

import { useContext } from 'react';

import { FactorsLibrarySelectionContext } from '../layout';
import { FactorDetailPanel } from './factor-detail-panel';

/** `/factors`：右侧为选中因子详情；选中项由 layout 列表与 Context 决定（无 URL id 时默认首项）。 */
export default function FactorsBrowsePage() {
  const effectiveSelectedId = useContext(FactorsLibrarySelectionContext);
  return <FactorDetailPanel factorId={effectiveSelectedId} />;
}
