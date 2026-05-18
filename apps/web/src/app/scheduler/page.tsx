'use client';

import { useEffect, useMemo } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';

import { EmptyState } from '@/components/empty-state';
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
  schedulerBusyJobIdAtom,
  schedulerJobActionErrorAtom,
  schedulerJobLimitAtom,
  schedulerJobPageAtom,
  schedulerJobsListAtoms,
  setSchedulerJobPageAtom,
} from '@/models/scheduler/jobs/list.atom';
import { schedulerActiveJobsAtoms } from '@/models/scheduler/jobs/active.atom';
import { schedulerJobTaskId } from '@/models/scheduler/jobs/dto';
import { useSchedulerJobEvents } from '@/models/scheduler/jobs/use-scheduler-job-events';

function toLocalTime(v: string | null): string {
  if (!v) return '-';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString();
}

export default function SchedulerPage() {
  const jobsData = useAtomValue(schedulerJobsListAtoms.valueAtom);
  const jobsLoading = useAtomValue(schedulerJobsListAtoms.loadingAtom);
  const jobFetchError = useAtomValue(schedulerJobsListAtoms.errorAtom);
  const jobActionError = useAtomValue(schedulerJobActionErrorAtom);
  const busyJobId = useAtomValue(schedulerBusyJobIdAtom);
  const jobLimit = useAtomValue(schedulerJobLimitAtom);
  const jobPage = useAtomValue(schedulerJobPageAtom);

  const refreshJobs = useSetAtom(schedulerJobsListAtoms.refreshAtom);
  const refreshActiveJobs = useSetAtom(schedulerActiveJobsAtoms.refreshAtom);
  const setJobPage = useSetAtom(setSchedulerJobPageAtom);
  const cancelJob = useSetAtom(cancelSchedulerJobAtom);

  const jobError = jobActionError ?? jobFetchError;
  const jobs = jobsData.jobs;
  const jobTotal = jobsData.total;

  useEffect(() => {
    void refreshJobs();
    void refreshActiveJobs();
  }, [refreshActiveJobs, refreshJobs]);

  useSchedulerJobEvents((options) => {
    void refreshJobs(options);
    void refreshActiveJobs(options);
  });

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
    <Page>
      <Card>
        <CardHeader>
          <CardTitle>作业列表</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {jobError ? (
            <Alert variant="destructive">
              <AlertTitle>作业操作失败</AlertTitle>
              <AlertDescription>{jobError}</AlertDescription>
            </Alert>
          ) : null}
          <div className="flex flex-wrap items-end gap-2">
            <Button type="button" variant="outline" onClick={() => void refreshJobs()} disabled={jobsLoading}>
              刷新
            </Button>
            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
              <Pagination className="mx-0 w-auto justify-end">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      aria-disabled={!canPrevPage || jobsLoading}
                      className={!canPrevPage || jobsLoading ? 'pointer-events-none opacity-50' : undefined}
                      onClick={(e) => {
                        e.preventDefault();
                        if (!canPrevPage || jobsLoading) return;
                        setJobPage(jobPage - 1);
                        void refreshJobs();
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
                            if (item === jobPage || jobsLoading) return;
                            setJobPage(item);
                            void refreshJobs();
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
                      aria-disabled={!canNextPage || jobsLoading}
                      className={!canNextPage || jobsLoading ? 'pointer-events-none opacity-50' : undefined}
                      onClick={(e) => {
                        e.preventDefault();
                        if (!canNextPage || jobsLoading) return;
                        setJobPage(jobPage + 1);
                        void refreshJobs();
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

          {jobsLoading && !jobs.length ? (
            <EmptyState variant="loading" title="加载中" compact />
          ) : !jobs.length ? (
            <EmptyState title="暂无作业" description="调度器运行后，作业记录将显示在此处。" compact />
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
                        <TableCell className="font-mono text-xs">{schedulerJobTaskId(job) ?? '-'}</TableCell>
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
