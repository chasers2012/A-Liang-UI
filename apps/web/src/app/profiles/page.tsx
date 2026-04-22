'use client';

import Link from 'next/link';
import { useAtomValue, useSetAtom } from 'jotai';
import { Plus } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Page } from '@/components/page';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useEffectMicrotask } from '@/hooks/use-effect-microtask';
import { getQuantAgentApiBase } from '@/api/client';
import { cn } from '@/lib/utils';
import {
  evaluationProfilesListAtom,
  refreshEvaluationProfilesListAtom,
} from '@/models/evaluation-profile/list-detail.atom';

export default function EvaluationProfilesPage() {
  const { items, error } = useAtomValue(evaluationProfilesListAtom);
  const refresh = useSetAtom(refreshEvaluationProfilesListAtom);

  useEffectMicrotask(() => {
    void refresh();
  }, [refresh]);

  return (
    <Page
      title="评价方案"
      description={
        <>
          配置评价流程（节点图 JSON）与 Alphalens 参数；运行因子评价时可选用方案。API{' '}
          <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">{getQuantAgentApiBase()}</code>
        </>
      }
    >
      {error && (
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>方案列表</CardTitle>
          <CardDescription>评价按工作流图执行；准备参数在「计算因子」节点上配置</CardDescription>
          <CardAction>
            <Link href="/profiles/new" className={cn(buttonVariants({ variant: 'default' }), 'gap-1.5')}>
              <Plus className="size-4" />
              新增方案
            </Link>
          </CardAction>
        </CardHeader>
        <CardContent className="p-0">
          {!items ? (
            <p className="p-6 text-sm text-muted-foreground">加载中…</p>
          ) : items.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">暂无方案。请使用上方「新增方案」开始配置。</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <span className="font-medium">{p.name}</span>
                      {p.description ? (
                        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{p.description}</p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/profiles/${encodeURIComponent(p.id)}`}
                        className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                      >
                        详情
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </Page>
  );
}
