'use client';

import { cn } from '@/lib/utils';
import type { BacktestRunStatus } from '@/models/backtest/dto';
import { BacktestStatusBadge } from './backtest-status-badge';
import { BacktestStrategyTitle } from './backtest-strategy-title';

export function BacktestRecordTitle({
  strategyId,
  strategyName,
  dataSetName,
  status,
  className,
  strategyClassName,
}: {
  strategyId: string | null | undefined;
  strategyName: string | null | undefined;
  dataSetName: string | null | undefined;
  status: BacktestRunStatus;
  className?: string;
  strategyClassName?: string;
}) {
  const dataSetLabel = dataSetName?.trim() || '未命名数据集';

  return (
    <span className={cn('inline-flex min-w-0 max-w-full flex-wrap items-center gap-x-2 gap-y-1', className)}>
      <BacktestStrategyTitle
        strategyId={strategyId}
        strategyName={strategyName}
        className={cn('min-w-0 shrink font-semibold leading-tight', strategyClassName)}
      />
      <span className="truncate text-sm font-normal text-muted-foreground">{dataSetLabel}</span>
      <BacktestStatusBadge status={status} />
    </span>
  );
}
