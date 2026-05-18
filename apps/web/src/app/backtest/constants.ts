import type { BacktestRunStatus } from '@/models/backtest/dto';

export const BACKTEST_STATUS_LABEL: Record<BacktestRunStatus, string> = {
  queued: '排队中',
  running: '运行中',
  success: '成功',
  failed: '失败',
  cancelled: '已取消',
};

export function backtestStatusBadgeVariant(
  status: BacktestRunStatus,
): 'default' | 'destructive' | 'secondary' | 'outline' {
  if (status === 'success') return 'default';
  if (status === 'failed') return 'destructive';
  if (status === 'running') return 'outline';
  return 'secondary';
}

/** 回测仍引用 strategy_id，但策略已从注册表删除。 */
export function isBacktestStrategyDeleted(
  strategyId: string | null | undefined,
  strategyName: string | null | undefined,
): boolean {
  return Boolean(strategyId?.trim()) && !strategyName?.trim();
}

export function backtestStrategyDisplayName(
  strategyId: string | null | undefined,
  strategyName: string | null | undefined,
): string {
  const name = strategyName?.trim();
  if (name) return name;
  const id = strategyId?.trim() ?? '';
  if (isBacktestStrategyDeleted(strategyId, strategyName)) return `策略 ${id.slice(0, 8)}`;
  return '未命名策略';
}
