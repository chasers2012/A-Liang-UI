import { atom } from 'jotai';

import {
  cancelSchedulerJob,
  deleteSchedulerTask,
  listSchedulerJobs,
  listSchedulerTasks,
  triggerSchedulerTask,
  updateSchedulerTask,
} from '@/api/scheduler';
import type { SchedulerJobPublic, SchedulerTaskPublic } from '@/models/scheduler/dto';
import { syncActiveSchedulerJobsFromPageAtom } from '@/models/scheduler/active-jobs.atom';

export type SchedulerPageState = {
  tasks: SchedulerTaskPublic[];
  jobs: SchedulerJobPublic[];
  loading: boolean;
  error: string | null;
  busyTaskId: string | null;
  busyJobId: string | null;
  jobLimit: string;
  jobPage: number;
  jobTotal: number;
};

export const schedulerPageAtom = atom<SchedulerPageState>({
  tasks: [],
  jobs: [],
  loading: false,
  error: null,
  busyTaskId: null,
  busyJobId: null,
  jobLimit: '50',
  jobPage: 1,
  jobTotal: 0,
});

export const setSchedulerJobLimitAtom = atom(null, (_get, set, value: string) => {
  set(schedulerPageAtom, (s) => ({ ...s, jobLimit: value, jobPage: 1 }));
});

export const setSchedulerJobPageAtom = atom(null, (_get, set, page: number) => {
  set(schedulerPageAtom, (s) => ({ ...s, jobPage: Math.max(1, page) }));
});

export const refreshSchedulerPageAtom = atom(null, async (get, set) => {
  const { jobLimit, jobPage } = get(schedulerPageAtom);
  set(schedulerPageAtom, (s) => ({ ...s, loading: true, error: null }));
  try {
    const parsedLimit = Number(jobLimit);
    const pageSize = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 50;
    const [tasks, jobs] = await Promise.all([listSchedulerTasks(), listSchedulerJobs({ page: jobPage, pageSize })]);
    set(schedulerPageAtom, (s) => ({
      ...s,
      tasks,
      jobs: jobs.items,
      jobTotal: jobs.total,
      loading: false,
      error: null,
    }));
    set(syncActiveSchedulerJobsFromPageAtom, { jobs: jobs.items, tasks });
  } catch (e) {
    set(schedulerPageAtom, (s) => ({
      ...s,
      loading: false,
      error: e instanceof Error ? e.message : String(e),
    }));
  }
});

export const triggerSchedulerTaskAtom = atom(null, async (_get, set, taskId: string) => {
  set(schedulerPageAtom, (s) => ({ ...s, busyTaskId: taskId, error: null }));
  try {
    await triggerSchedulerTask(taskId, {});
    await set(refreshSchedulerPageAtom);
  } catch (e) {
    set(schedulerPageAtom, (s) => ({
      ...s,
      error: e instanceof Error ? e.message : String(e),
    }));
  } finally {
    set(schedulerPageAtom, (s) => ({ ...s, busyTaskId: null }));
  }
});

export const toggleSchedulerTaskEnabledAtom = atom(
  null,
  async (_get, set, payload: { taskId: string; enabled: boolean }) => {
    set(schedulerPageAtom, (s) => ({ ...s, busyTaskId: payload.taskId, error: null }));
    try {
      await updateSchedulerTask(payload.taskId, { enabled: !payload.enabled });
      await set(refreshSchedulerPageAtom);
    } catch (e) {
      set(schedulerPageAtom, (s) => ({
        ...s,
        error: e instanceof Error ? e.message : String(e),
      }));
    } finally {
      set(schedulerPageAtom, (s) => ({ ...s, busyTaskId: null }));
    }
  },
);

export const deleteSchedulerTaskAtom = atom(null, async (_get, set, taskId: string) => {
  set(schedulerPageAtom, (s) => ({ ...s, busyTaskId: taskId, error: null }));
  try {
    await deleteSchedulerTask(taskId);
    await set(refreshSchedulerPageAtom);
  } catch (e) {
    set(schedulerPageAtom, (s) => ({
      ...s,
      error: e instanceof Error ? e.message : String(e),
    }));
  } finally {
    set(schedulerPageAtom, (s) => ({ ...s, busyTaskId: null }));
  }
});

export const cancelSchedulerJobAtom = atom(null, async (_get, set, jobId: string) => {
  set(schedulerPageAtom, (s) => ({ ...s, busyJobId: jobId, error: null }));
  try {
    await cancelSchedulerJob(jobId);
    await set(refreshSchedulerPageAtom);
  } catch (e) {
    set(schedulerPageAtom, (s) => ({
      ...s,
      error: e instanceof Error ? e.message : String(e),
    }));
  } finally {
    set(schedulerPageAtom, (s) => ({ ...s, busyJobId: null }));
  }
});
