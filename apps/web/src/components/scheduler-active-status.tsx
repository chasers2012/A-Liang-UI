'use client';

import { useEffect } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { Loader2 } from 'lucide-react';
import { usePathname } from 'next/navigation';

import { NavigationGuardLink } from '@/components/navigation-guard-link';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSidebar } from '@/components/ui/sidebar';
import { eventBus, type EventHandler } from '@/api/events';
import { schedulerJobTaskType, type SchedulerJobPublic, type SchedulerJobStatus } from '@/models/scheduler/jobs/dto';
import {
  activeSchedulerJobsAtom,
  applySchedulerJobEventAtom,
  applySchedulerTaskEventAtom,
} from '@/models/scheduler/jobs/active.atom';
import type { SchedulerTaskPublic } from '@/models/scheduler/tasks/dto';
import { cn } from '@/lib/utils';

const STATUS_LABEL: Record<SchedulerJobStatus, string> = {
  queued: '排队中',
  running: '运行中',
  succeeded: '成功',
  failed: '失败',
  retrying: '重试中',
  cancelled: '已取消',
};

function isSchedulerPath(pathname: string): boolean {
  return pathname === '/scheduler' || pathname.startsWith('/scheduler/');
}

function jobLabel(job: SchedulerJobPublic): string {
  const name = job.task?.name ?? schedulerJobTaskType(job);
  return `${name} · ${STATUS_LABEL[job.status]}`;
}

function summaryLabel(jobs: SchedulerJobPublic[]): string {
  if (jobs.length === 1) return jobLabel(jobs[0]);
  return `${jobs.length} 个任务进行中`;
}

function tooltipContent(jobs: SchedulerJobPublic[]): string {
  return jobs.map((job) => jobLabel(job)).join('\n');
}

const chipClassName =
  'inline-flex max-w-full items-center gap-2 rounded-md border border-border/80 bg-muted/40 px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-muted/60';

export function SchedulerActiveJobsPoller() {
  const pathname = usePathname();
  const applyJob = useSetAtom(applySchedulerJobEventAtom);
  const applyTask = useSetAtom(applySchedulerTaskEventAtom);
  const onSchedulerPage = isSchedulerPath(pathname);

  useEffect(() => {
    if (onSchedulerPage) return;

    const onJobUpdated: EventHandler<SchedulerJobPublic> = (data) => {
      applyJob(data);
    };
    const onTaskUpdated: EventHandler<SchedulerTaskPublic & { deleted?: boolean }> = (data) => {
      applyTask(data);
    };

    const offJob = eventBus.on('scheduler.job.updated', onJobUpdated);
    const offTask = eventBus.on('scheduler.task.updated', onTaskUpdated);
    return () => {
      offJob();
      offTask();
    };
  }, [applyJob, applyTask, onSchedulerPage]);

  return null;
}

export function SchedulerActiveStatus() {
  const jobs = useAtomValue(activeSchedulerJobsAtom);
  const { state, isMobile } = useSidebar();
  const collapsed = !isMobile && state === 'collapsed';

  if (jobs.length === 0) return null;

  const tooltip = tooltipContent(jobs);

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <NavigationGuardLink
              href="/scheduler"
              className={cn(
                'inline-flex size-8 items-center justify-center rounded-md text-foreground transition-colors hover:bg-sidebar-accent',
              )}
              aria-label={summaryLabel(jobs)}
            >
              <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
            </NavigationGuardLink>
          }
        />
        <TooltipContent side="right" className="max-w-xs whitespace-pre-line">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <NavigationGuardLink href="/scheduler" className={chipClassName}>
      <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" aria-hidden />
      <span className="min-w-0 truncate">{summaryLabel(jobs)}</span>
    </NavigationGuardLink>
  );
}
