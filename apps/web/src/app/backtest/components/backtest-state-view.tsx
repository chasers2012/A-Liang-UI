'use client';

import type { ReactNode } from 'react';

import { EmptyState } from '@/components/empty-state';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function resolveBacktestDetailStatusContent({
  run,
  error,
}: {
  run: { id: string; status: string } | null;
  error: string | null;
}): ReactNode | null {
  if (!run && !error) {
    return <EmptyState variant="loading" title="加载中" className="flex min-h-0 flex-1" />;
  }
  if (error || !run) {
    return (
      <Alert variant="destructive">
        <AlertTitle>加载失败</AlertTitle>
        <AlertDescription className="break-words whitespace-pre-wrap">{error ?? '未知错误'}</AlertDescription>
      </Alert>
    );
  }
  return null;
}
