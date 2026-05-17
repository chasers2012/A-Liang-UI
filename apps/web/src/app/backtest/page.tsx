'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';

import { EmptyState } from '@/components/empty-state';
import { Page } from '@/components/page';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BacktestRunForm } from './ui/backtest-run-form';
import { backtestsListAtoms } from '@/models/backtest/list.atom';
import { useBacktestEvents } from '@/models/backtest/use-backtest-events';

export default function BacktestPage() {
  const items = useAtomValue(backtestsListAtoms.valueAtom);

  const refreshList = useSetAtom(backtestsListAtoms.refreshAtom);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  useBacktestEvents(refreshList);

  return (
    <Page title="回测" description="历史回测与结果分析。">
      <BacktestRunForm />

      <Card>
        <CardHeader>
          <CardTitle>回测记录</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!items ? (
            <EmptyState variant="loading" title="加载中" />
          ) : items.length === 0 ? (
            <EmptyState title="暂无回测记录" description="提交回测后，记录将显示在此处。" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>策略</TableHead>
                  <TableHead>数据集</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm font-medium">{r.strategy_name || '-'}</TableCell>
                    <TableCell className="text-sm">{r.data_set_name || '-'}</TableCell>
                    <TableCell>{r.status}</TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/backtest/${encodeURIComponent(r.id)}`}
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
