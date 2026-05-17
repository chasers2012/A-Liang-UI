'use client';

import { useEffect, useMemo } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';

import { Page } from '@/components/page';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  cancelSchedulerJobAtom,
  deleteSchedulerTaskAtom,
  refreshSchedulerPageAtom,
  schedulerPageAtom,
  setSchedulerJobPageAtom,
  toggleSchedulerTaskEnabledAtom,
  triggerSchedulerTaskAtom,
} from '@/models/scheduler/list-detail.atom';
import { useSchedulerEvents } from '@/models/scheduler/use-scheduler-events';

function toLocalTime(v: string | null): string {
  if (!v) return '-';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString();
}

export default function SchedulerPage() {
  const { tasks, jobs, loading, error, busyTaskId, busyJobId, jobLimit, jobPage, jobTotal } =
    useAtomValue(schedulerPageAtom);
  const refreshAll = useSetAtom(refreshSchedulerPageAtom);
  const setJobPage = useSetAtom(setSchedulerJobPageAtom);
  const triggerTask = useSetAtom(triggerSchedulerTaskAtom);
  const toggleTaskEnabled = useSetAtom(toggleSchedulerTaskEnabledAtom);
  const deleteTask = useSetAtom(deleteSchedulerTaskAtom);
  const cancelJob = useSetAtom(cancelSchedulerJobAtom);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  useSchedulerEvents(refreshAll);

  const sortedTasks = useMemo(
    () =>
      tasks
        .slice()
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .reverse(),
    [tasks],
  );
  const pageSize = useMemo(() => {
    const parsed = Number(jobLimit);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 50;
  }, [jobLimit]);
  const totalPages = Math.max(1, Math.ceil(jobTotal / pageSize));
  const canPrevPage = jobPage > 1;
  const canNextPage = jobPage < totalPages;
  const pageItems = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: Array<number | 'ellipsis'> = [1];
    const start = Math.max(2, jobPage - 1);
    const end = Math.min(totalPages - 1, jobPage + 1);

    if (start > 2) {
      pages.push('ellipsis');
    }
    for (let page = start; page <= end; page += 1) {
      pages.push(page);
    }
    if (end < totalPages - 1) {
      pages.push('ellipsis');
    }
    pages.push(totalPages);
    return pages;
  }, [jobPage, totalPages]);

  return (
    <Page title="任务调度" description="管理 scheduler 任务，支持手动触发、Cron 定时与作业状态查询。">
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>操作失败</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>任务列表</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading && !sortedTasks.length ? (
            <p className="p-6 text-sm text-muted-foreground">加载中...</p>
          ) : !sortedTasks.length ? (
            <p className="p-6 text-sm text-muted-foreground">暂无任务。</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Cron</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead>Next Run</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedTasks.map((task) => {
                  const isBusy = busyTaskId === task.id;
                  return (
                    <TableRow key={task.id}>
                      <TableCell className="font-medium">{task.name}</TableCell>
                      <TableCell className="font-mono text-xs">{task.task_type}</TableCell>
                      <TableCell className="font-mono text-xs">{task.cron_expr || '-'}</TableCell>
                      <TableCell>{task.enabled ? 'yes' : 'no'}</TableCell>
                      <TableCell>{toLocalTime(task.next_run_at)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isBusy}
                            onClick={() => void triggerTask(task.id)}
                          >
                            触发
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isBusy}
                            onClick={() => void toggleTaskEnabled({ taskId: task.id, enabled: task.enabled })}
                          >
                            {task.enabled ? '停用' : '启用'}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={isBusy}
                            onClick={() => void deleteTask(task.id)}
                          >
                            删除
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>作业列表</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <Button type="button" variant="outline" onClick={() => void refreshAll()} disabled={loading}>
              刷新
            </Button>
            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
              <Pagination className="mx-0 w-auto justify-end">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      aria-disabled={!canPrevPage || loading}
                      className={!canPrevPage || loading ? 'pointer-events-none opacity-50' : undefined}
                      onClick={(e) => {
                        e.preventDefault();
                        if (!canPrevPage || loading) return;
                        setJobPage(jobPage - 1);
                        void refreshAll();
                      }}
                    />
                  </PaginationItem>
                  {pageItems.map((item, index) =>
                    item === 'ellipsis' ? (
                      <PaginationItem key={`ellipsis-${index}`}>
                        <PaginationEllipsis />
                      </PaginationItem>
                    ) : (
                      <PaginationItem key={item}>
                        <PaginationLink
                          href="#"
                          isActive={item === jobPage}
                          onClick={(e) => {
                            e.preventDefault();
                            if (item === jobPage || loading) return;
                            setJobPage(item);
                            void refreshAll();
                          }}
                        >
                          {item}
                        </PaginationLink>
                      </PaginationItem>
                    ),
                  )}
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      aria-disabled={!canNextPage || loading}
                      className={!canNextPage || loading ? 'pointer-events-none opacity-50' : undefined}
                      onClick={(e) => {
                        e.preventDefault();
                        if (!canNextPage || loading) return;
                        setJobPage(jobPage + 1);
                        void refreshAll();
                      }}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
              <span className="text-sm text-muted-foreground">
                共 {jobTotal} 条 / {totalPages} 页
              </span>
            </div>
          </div>

          {!jobs.length ? (
            <p className="text-sm text-muted-foreground">暂无作业。</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job ID</TableHead>
                    <TableHead>Task ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Trigger</TableHead>
                    <TableHead>Attempt</TableHead>
                    <TableHead>Queued At</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job) => {
                    const cancellable = ['queued', 'running', 'retrying'].includes(job.status);
                    return (
                      <TableRow key={job.id}>
                        <TableCell className="font-mono text-xs">{job.id}</TableCell>
                        <TableCell className="font-mono text-xs">{job.task_id ?? '-'}</TableCell>
                        <TableCell>{job.status}</TableCell>
                        <TableCell>{job.trigger_type}</TableCell>
                        <TableCell>
                          {job.attempt}/{job.max_retries}
                        </TableCell>
                        <TableCell>{toLocalTime(job.queued_at)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!cancellable || busyJobId === job.id}
                            onClick={() => void cancelJob(job.id)}
                          >
                            取消
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </Page>
  );
}
