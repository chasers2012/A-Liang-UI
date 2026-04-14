import { atom } from 'jotai';
import { atomFamily } from 'jotai-family';

import { createStrategy, getStrategy, patchStrategy } from '@/api';
import { defaultNewName } from '@/lib/default-new-name';
import { EMPTY_WORKFLOW } from '@/components/workflow-graph/reactflow/serialize';
import type { WorkflowGraphPersisted } from '@/components/workflow-graph/reactflow/types';

export type StrategyFormState = {
  loading: boolean;
  templateLoading: boolean;
  submitting: boolean;
  loadError: string | null;
  formError: string | null;
  name: string;
  description: string;
  workflow: WorkflowGraphPersisted;
};

export const strategyFormStateAtomFamily = atomFamily((key: string) => {
  void key;
  return atom<StrategyFormState>({
    loading: false,
    templateLoading: false,
    submitting: false,
    loadError: null,
    formError: null,
    name: '',
    description: '',
    workflow: EMPTY_WORKFLOW,
  });
});

export const initStrategyFormAtomFamily = atomFamily((key: string) =>
  atom(null, async (_get, set, id?: string | null) => {
    const isEdit = Boolean(id);

    set(strategyFormStateAtomFamily(key), (s) => ({
      ...s,
      loadError: null,
      formError: null,
      loading: isEdit,
      templateLoading: !isEdit,
    }));

    if (isEdit && id) {
      try {
        const d = await getStrategy(id);
        set(strategyFormStateAtomFamily(key), (s) => ({
          ...s,
          loading: false,
          templateLoading: false,
          name: d.name,
          description: d.description,
          workflow: d.workflow,
        }));
      } catch (e) {
        set(strategyFormStateAtomFamily(key), (s) => ({
          ...s,
          loading: false,
          templateLoading: false,
          loadError: e instanceof Error ? e.message : String(e),
        }));
      }
      return;
    }

    // New strategy: prefill name and start from an empty workflow.
    set(strategyFormStateAtomFamily(key), (s) => ({
      ...s,
      name: s.name.trim() ? s.name : defaultNewName('新策略'),
      templateLoading: false,
      workflow: EMPTY_WORKFLOW,
    }));
  }),
);

export const setStrategyFormNameAtomFamily = atomFamily((key: string) =>
  atom(null, (_get, set, name: string) => {
    set(strategyFormStateAtomFamily(key), (s) => ({ ...s, name }));
  }),
);

export const setStrategyFormDescriptionAtomFamily = atomFamily((key: string) =>
  atom(null, (_get, set, description: string) => {
    set(strategyFormStateAtomFamily(key), (s) => ({ ...s, description }));
  }),
);

export const setStrategyFormWorkflowAtomFamily = atomFamily((key: string) =>
  atom(null, (_get, set, workflow: WorkflowGraphPersisted) => {
    set(strategyFormStateAtomFamily(key), (s) => ({ ...s, workflow }));
  }),
);

export const submitStrategyFormAtomFamily = atomFamily((key: string) =>
  atom(null, async (get, set, payload: { id?: string | null; workflow: WorkflowGraphPersisted }) => {
    const { id, workflow } = payload;
    const isEdit = Boolean(id);
    const s = get(strategyFormStateAtomFamily(key));

    set(strategyFormStateAtomFamily(key), (st) => ({ ...st, submitting: true, formError: null }));
    try {
      if (isEdit) {
        if (!id) throw new Error('无效 id');
        await patchStrategy(id, {
          name: s.name.trim(),
          description: s.description.trim(),
          workflow,
        });
        set(strategyFormStateAtomFamily(key), (st) => ({ ...st, submitting: false }));
        return id;
      }
      const created = await createStrategy({
        name: s.name.trim(),
        description: s.description.trim(),
        workflow,
      });
      set(strategyFormStateAtomFamily(key), (st) => ({ ...st, submitting: false }));
      return created.id;
    } catch (e) {
      set(strategyFormStateAtomFamily(key), (st) => ({
        ...st,
        submitting: false,
        formError: e instanceof Error ? e.message : String(e),
      }));
      return null;
    }
  }),
);
