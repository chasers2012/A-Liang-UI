'use client';

import { Page } from '@/components/page';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function resolveBacktestStateView({
  invalidRunId,
  run,
  error,
}: {
  invalidRunId: boolean;
  run: { id: string; status: string } | null;
  error: string | null;
}) {
  if (invalidRunId) {
    return (
      <Page title="回测详情">
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>无效回测 ID</AlertDescription>
        </Alert>
      </Page>
    );
  }
  if (!run && !error) {
    return (
      <Page title="回测详情">
        <p className="text-sm text-muted-foreground">加载中…</p>
      </Page>
    );
  }
  if (error || !run) {
    return (
      <Page title="回测详情">
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>{error ?? '未知错误'}</AlertDescription>
        </Alert>
      </Page>
    );
  }
  return null;
}
