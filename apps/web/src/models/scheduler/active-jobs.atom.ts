import { atom } from 'jotai';

import { listActiveSchedulerJobs, type SchedulerActiveJob } from '@/api/scheduler';

export const activeSchedulerJobsAtom = atom<SchedulerActiveJob[]>([]);

export const hasActiveSchedulerJobsAtom = atom((get) => get(activeSchedulerJobsAtom).length > 0);

export const refreshActiveSchedulerJobsAtom = atom(null, async (_get, set) => {
  try {
    const jobs = await listActiveSchedulerJobs();
    set(activeSchedulerJobsAtom, jobs);
  } catch {
    // ignore polling errors
  }
});
