'use client';

import { Badge } from '@/components/reui/badge';
import { BACKTEST_STATUS_LABEL, backtestStatusBadgeVariant } from '../constants';
import type { BacktestRunStatus } from '@/models/backtest/dto';

export function BacktestStatusBadge({ status }: { status: BacktestRunStatus }) {
  return (
    <Badge variant={backtestStatusBadgeVariant(status)} size="sm">
      {BACKTEST_STATUS_LABEL[status]}
    </Badge>
  );
}
