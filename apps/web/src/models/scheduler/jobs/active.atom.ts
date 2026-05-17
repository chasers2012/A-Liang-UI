import { atom } from 'jotai';

import { listActiveSchedulerJobs } from '@/api/scheduler';
import { createRefreshableAsyncAtoms } from '@/lib/refreshable-async-atoms';
import {
  schedulerJobTaskId,
  type SchedulerJobPublic,
  type SchedulerJobStatus,
  type SchedulerJobTaskPublic,
} from '@/models/scheduler/jobs/dto';
import type { SchedulerTaskPublic } from '@/models/scheduler/tasks/dto';

const ACTIVE_JOB_STATUSES = new Set<SchedulerJobStatus>(['queued', 'running', 'retrying']);
const MAX_ACTIVE_JOBS = 10;

export const schedulerActiveJobsAtoms = createRefreshableAsyncAtoms<SchedulerJobPublic[]>({
  initialValue: [],
  fetcher: async () => await listActiveSchedulerJobs(MAX_ACTIVE_JOBS),
});

/** @deprecated Prefer {@link schedulerActiveJobsAtoms.valueAtom}. */
export const activeSchedulerJobsAtom = schedulerActiveJobsAtoms.valueAtom;

export const hasActiveSchedulerJobsAtom = atom((get) => get(schedulerActiveJobsAtoms.valueAtom).length > 0);

function sortAndCapActiveJobs(jobs: SchedulerJobPublic[]): SchedulerJobPublic[] {
  return jobs
    .slice()
    .sort((a, b) => b.queued_at.localeCompare(a.queued_at))
    .slice(0, MAX_ACTIVE_JOBS);
}

function taskToJobTask(task: SchedulerTaskPublic): SchedulerJobTaskPublic {
  return {
    id: task.id,
    name: task.name,
    task_type: task.task_type,
    enabled: task.enabled,
  };
}

/** Apply a single ``scheduler.job.updated`` payload (envelope ``data`` field). */
export const applySchedulerJobEventAtom = atom(null, (_get, set, job: SchedulerJobPublic) => {
  const isActive = ACTIVE_JOB_STATUSES.has(job.status);

  set(schedulerActiveJobsAtoms.valueAtom, (prev) => {
    const without = prev.filter((j) => j.id !== job.id);
    if (!isActive) return without;
    return sortAndCapActiveJobs([...without, job]);
  });
});

type SchedulerTaskEventPayload = SchedulerTaskPublic & { deleted?: boolean };

/** Apply a single ``scheduler.task.updated`` payload (envelope ``data`` field). */
export const applySchedulerTaskEventAtom = atom(null, (_get, set, task: SchedulerTaskEventPayload) => {
  const jobTask = task.deleted ? null : taskToJobTask(task);

  set(schedulerActiveJobsAtoms.valueAtom, (prev) =>
    prev.map((job) => {
      if (schedulerJobTaskId(job) !== task.id) return job;
      return { ...job, task: jobTask };
    }),
  );
});
