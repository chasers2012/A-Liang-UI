'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { Plus } from 'lucide-react';
import { useAtomValue, useSetAtom } from 'jotai';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Page } from '@/components/page';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { refreshStrategiesListAtom, strategiesListAtom } from '@/models/strategy/list-detail.atom';

export default function StrategiesPage() {
  const { items, error } = useAtomValue(strategiesListAtom);
  const refresh = useSetAtom(refreshStrategiesListAtom);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <Page title="策略" description="策略定义与维护。">
      {error && (
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>策略列表</CardTitle>
          <CardDescription>节点化编辑策略工作流并发起回测</CardDescription>
          <CardAction>
            <Link href="/strategies/new" className={cn(buttonVariants({ variant: 'default' }), 'gap-1.5')}>
              <Plus className="size-4" />
              新增策略
            </Link>
          </CardAction>
        </CardHeader>
        <CardContent className="p-0">
          {!items ? (
            <p className="p-6 text-sm text-muted-foreground">加载中…</p>
          ) : items.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">暂无策略。请使用上方「新增策略」开始配置。</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <span className="font-medium">{s.name}</span>
                      {s.description ? <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{s.description}</p> : null}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/strategies/${encodeURIComponent(s.id)}`} className="text-sm font-medium text-primary underline-offset-4 hover:underline">
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
