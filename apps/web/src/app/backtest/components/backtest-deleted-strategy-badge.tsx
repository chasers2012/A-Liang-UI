'use client';

import { Badge } from '@/components/reui/badge';

export function BacktestDeletedStrategyBadge() {
  return (
    <Badge variant="destructive" size="sm" className="shrink-0">
      策略已删除
    </Badge>
  );
}
