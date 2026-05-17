import { atom } from 'jotai';

import { listActiveSchedulerJobs, type SchedulerActiveJob } from '@/api/scheduler';
import type { SchedulerJobPublic, SchedulerJobStatus, SchedulerTaskPublic } from '@/models/scheduler/dto';

const ACTIVE_JOB_STATUSES = new Set<SchedulerJobStatus>(['queued', 'running', 'retrying']);
const MAX_ACTIVE_JOBS = 10;

export const activeSchedulerJobsAtom = atom<SchedulerActiveJob[]>([]);

/** Task id → display name, updated from ``scheduler.task.updated`` SSE events. */
export const schedulerTaskNamesAtom = atom<Record<string, string>>({});

export const hasActiveSchedulerJobsAtom = atom((get) => get(activeSchedulerJobsAtom).length > 0);

function toActiveJob(job: SchedulerJobPublic, taskNameById: Record<string, string>): SchedulerActiveJob {
  return {
    ...job,
    taskName: job.task_id ? taskNameById[job.task_id] : undefined,
  };
}

function toActiveJobs(jobs: SchedulerJobPublic[], tasks: SchedulerTaskPublic[]): SchedulerActiveJob[] {
  const taskNameById = Object.fromEntries(tasks.map((t) => [t.id, t.name]));
  return jobs.filter((job) => ACTIVE_JOB_STATUSES.has(job.status)).map((job) => toActiveJob(job, taskNameById));
}

function sortAndCapActiveJobs(jobs: SchedulerActiveJob[]): SchedulerActiveJob[] {
  return jobs
    .slice()
    .sort((a, b) => b.queued_at.localeCompare(a.queued_at))
    .slice(0, MAX_ACTIVE_JOBS);
}

export const syncActiveSchedulerJobsFromPageAtom = atom(
  null,
  (_get, set, payload: { jobs: SchedulerJobPublic[]; tasks: SchedulerTaskPublic[] }) => {
    set(schedulerTaskNamesAtom, Object.fromEntries(payload.tasks.map((t) => [t.id, t.name])));
    set(activeSchedulerJobsAtom, toActiveJobs(payload.jobs, payload.tasks));
  },
);

/** Apply a single ``scheduler.job.updated`` payload (envelope ``data`` field). */
export const applySchedulerJobEventAtom = atom(null, (get, set, job: SchedulerJobPublic) => {
  const taskNameById = get(schedulerTaskNamesAtom);
  const active = toActiveJob(job, taskNameById);
  const isActive = ACTIVE_JOB_STATUSES.has(job.status);

  set(activeSchedulerJobsAtom, (prev) => {
    const without = prev.filter((j) => j.id !== job.id);
    if (!isActive) return without;
    return sortAndCapActiveJobs([...without, active]);
  });
});

type SchedulerTaskEventPayload = SchedulerTaskPublic & { deleted?: boolean };

/** Apply a single ``scheduler.task.updated`` payload (envelope ``data`` field). */
export const applySchedulerTaskEventAtom = atom(null, (_get, set, task: SchedulerTaskEventPayload) => {
  if (task.deleted) {
    set(schedulerTaskNamesAtom, (prev) => {
      const next = { ...prev };
      delete next[task.id];
      return next;
    });
    set(activeSchedulerJobsAtom, (prev) =>
      prev.map((job) => (job.task_id === task.id ? { ...job, taskName: undefined } : job)),
    );
    return;
  }

  set(schedulerTaskNamesAtom, (prev) => ({ ...prev, [task.id]: task.name }));
  set(activeSchedulerJobsAtom, (prev) =>
    prev.map((job) => (job.task_id === task.id ? { ...job, taskName: task.name } : job)),
  );
});

export const refreshActiveSchedulerJobsAtom = atom(null, async (_get, set) => {
  try {
    const jobs = await listActiveSchedulerJobs();
    set(activeSchedulerJobsAtom, jobs);
    const taskNameById = Object.fromEntries(
      jobs.flatMap((j) => (j.task_id && j.taskName ? [[j.task_id, j.taskName] as const] : [])),
    );
    if (Object.keys(taskNameById).length > 0) {
      set(schedulerTaskNamesAtom, (prev) => ({ ...prev, ...taskNameById }));
    }
  } catch {
    // ignore fetch errors
  }
});
