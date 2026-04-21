'use client';

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
  if (!strategyId) return <p className="text-sm text-muted-foreground">该回测未关联策略工作流。</p>;
  if (strategyError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>加载失败</AlertTitle>
        <AlertDescription>{strategyError}</AlertDescription>
      </Alert>
    );
  }
  if (!strategyDetail) return <p className="text-sm text-muted-foreground">加载工作流中…</p>;
  if (!strategyNodeCatalog && !strategyNodeCatalogError) {
    return <p className="text-sm text-muted-foreground">加载节点类型中…</p>;
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
