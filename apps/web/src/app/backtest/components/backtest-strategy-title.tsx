'use client';

import { cn } from '@/lib/utils';
import { backtestStrategyDisplayName, isBacktestStrategyDeleted } from '../constants';
import { BacktestDeletedStrategyBadge } from './backtest-deleted-strategy-badge';

export function BacktestStrategyTitle({
  strategyId,
  strategyName,
  className,
}: {
  strategyId: string | null | undefined;
  strategyName: string | null | undefined;
  className?: string;
}) {
  const isDeleted = isBacktestStrategyDeleted(strategyId, strategyName);
  const label = backtestStrategyDisplayName(strategyId, strategyName);

  return (
    <span className={cn('inline-flex min-w-0 max-w-full items-center gap-1.5', className)}>
      <span className="truncate">{label}</span>
      {isDeleted ? <BacktestDeletedStrategyBadge /> : null}
    </span>
  );
}
