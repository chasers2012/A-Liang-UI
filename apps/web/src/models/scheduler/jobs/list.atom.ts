import { atom } from 'jotai';

import { cancelSchedulerJob, listSchedulerJobs } from '@/api/scheduler';
import { createRefreshableAsyncAtoms } from '@/lib/refreshable-async-atoms';
import { schedulerActiveJobsAtoms } from '@/models/scheduler/jobs/active.atom';
import type { SchedulerJobPublic } from '@/models/scheduler/jobs/dto';

export type SchedulerJobsPageData = {
  jobs: SchedulerJobPublic[];
  total: number;
};

const initialJobsPageData: SchedulerJobsPageData = {
  jobs: [],
  total: 0,
};

export const schedulerJobLimitAtom = atom('50');
export const schedulerJobPageAtom = atom(1);
export const schedulerJobActionErrorAtom = atom<string | null>(null);
export const schedulerBusyJobIdAtom = atom<string | null>(null);

const coreJobsListAtoms = createRefreshableAsyncAtoms<SchedulerJobsPageData>({
  initialValue: initialJobsPageData,
  fetcher: async (get) => {
    const jobLimit = get(schedulerJobLimitAtom);
    const jobPage = get(schedulerJobPageAtom);
    const parsedLimit = Number(jobLimit);
    const pageSize = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 50;
    const page = await listSchedulerJobs({ page: jobPage, pageSize });
    return {
      jobs: page.items,
      total: page.total,
    };
  },
});

export const schedulerJobsListAtoms = {
  ...coreJobsListAtoms,
  refreshAtom: atom(null, (_get, set) => {
    set(schedulerJobActionErrorAtom, null);
    set(coreJobsListAtoms.refreshAtom);
  }),
};

export const setSchedulerJobLimitAtom = atom(null, (_get, set, value: string) => {
  set(schedulerJobLimitAtom, value);
  set(schedulerJobPageAtom, 1);
});

export const setSchedulerJobPageAtom = atom(null, (_get, set, page: number) => {
  set(schedulerJobPageAtom, Math.max(1, page));
});

export const cancelSchedulerJobAtom = atom(null, async (_get, set, jobId: string) => {
  set(schedulerBusyJobIdAtom, jobId);
  set(schedulerJobActionErrorAtom, null);
  try {
    await cancelSchedulerJob(jobId);
    set(schedulerJobsListAtoms.refreshAtom);
    set(schedulerActiveJobsAtoms.refreshAtom);
  } catch (e) {
    set(schedulerJobActionErrorAtom, e instanceof Error ? e.message : String(e));
  } finally {
    set(schedulerBusyJobIdAtom, null);
  }
});
