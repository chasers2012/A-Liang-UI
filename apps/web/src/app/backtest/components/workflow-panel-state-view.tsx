'use client';

import { EmptyState } from '@/components/empty-state';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { StrategyDetailPanelData } from '../types';

export function resolveWorkflowPanelStateView({
  strategyId,
  strategyError,
  strategyDetail,
  strategyNodeCatalog,
  strategyNodeCatalogError,
}: {
  strategyId: string;
  strategyError: string | null;
  strategyDetail: StrategyDetailPanelData | null;
  strategyNodeCatalog: unknown[] | null;
  strategyNodeCatalogError: string | null;
}) {
  if (!strategyId) {
    return <EmptyState title="无工作流" description="该回测未关联策略工作流。" compact />;
  }
  if (strategyError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>加载失败</AlertTitle>
        <AlertDescription>{strategyError}</AlertDescription>
      </Alert>
    );
  }
  if (!strategyDetail) {
    return <EmptyState variant="loading" title="加载中" description="正在加载工作流…" compact />;
  }
  if (!strategyNodeCatalog && !strategyNodeCatalogError) {
    return <EmptyState variant="loading" title="加载中" description="正在加载节点类型…" compact />;
  }
  if (strategyNodeCatalogError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>加载失败</AlertTitle>
        <AlertDescription>{strategyNodeCatalogError}</AlertDescription>
      </Alert>
    );
  }
  return null;
}
