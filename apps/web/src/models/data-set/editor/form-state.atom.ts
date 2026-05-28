import { atom } from 'jotai';

import type { WorkflowGraphPersisted } from '@/components/workflow-graph/reactflow/types';
import { syncSystemPreprocessingWorkflow } from '@/app/data/data-sets/components/panel/system-preprocessing-node-types';

import { emptyDataSetForm, sameWorkflowGraph, type DataSetBindingFormRow, type DataSetFormState } from '../form-logic';

export type DataSetEditorState = {
  editorLoading: boolean;
  editorLoadError: string | null;
  submitting: boolean;
  formError: string | null;
  form: DataSetFormState;
};

export function resetDataSetEditorState(): DataSetEditorState {
  return {
    editorLoading: false,
    editorLoadError: null,
    submitting: false,
    formError: null,
    form: emptyDataSetForm(),
  };
}

export const dataSetEditorStateAtom = atom<DataSetEditorState>(resetDataSetEditorState());

/**
 * Tick that bumps whenever editor hydration completes（画布 remount 用）。
 */
export const dataSetEditorHydrateTickAtom = atom(0);

export const setDataSetEditorFormPatchAtom = atom(null, (_get, set, patch: Partial<DataSetFormState>) => {
  set(dataSetEditorStateAtom, (s) => ({ ...s, form: { ...s.form, ...patch } }));
});

export const addDataSetEditorBindingAtom = atom(null, (_get, set) => {
  set(dataSetEditorStateAtom, (s) => ({
    ...s,
    form: {
      ...s.form,
      bindings: [
        ...s.form.bindings,
        {
          datasource_id: '',
          columns: [],
        },
      ],
    },
  }));
});

export const updateDataSetEditorBindingAtom = atom(
  null,
  (_get, set, input: { index: number; patch: Partial<DataSetBindingFormRow> }) => {
    set(dataSetEditorStateAtom, (s) => ({
      ...s,
      form: {
        ...s.form,
        bindings: s.form.bindings.map((row, i) => (i === input.index ? { ...row, ...input.patch } : row)),
      },
    }));
  },
);

export const removeDataSetEditorBindingAtom = atom(null, (_get, set, index: number) => {
  set(dataSetEditorStateAtom, (s) => ({
    ...s,
    form: {
      ...s.form,
      bindings: s.form.bindings.length <= 1 ? s.form.bindings : s.form.bindings.filter((_, i) => i !== index),
    },
  }));
});

export const syncDataSetEditorSystemWorkflowAtom = atom(
  null,
  async (
    get,
    set,
    input: {
      liveGraph?: WorkflowGraphPersisted | null;
      datasourceNameById: Record<string, string>;
      template: WorkflowGraphPersisted | null;
    },
  ) => {
    const { form } = get(dataSetEditorStateAtom);
    const datasourceIds = [...new Set(form.bindings.map((b) => b.datasource_id.trim()).filter(Boolean))];
    const baseWorkflow = input.liveGraph ?? form.preprocessing_workflow;
    const syncedWorkflow = syncSystemPreprocessingWorkflow(
      baseWorkflow,
      datasourceIds,
      input.datasourceNameById,
      input.template,
    );
    if (sameWorkflowGraph(form.preprocessing_workflow, syncedWorkflow) && !input.liveGraph) return;
    set(dataSetEditorStateAtom, (s) => ({ ...s, form: { ...s.form, preprocessing_workflow: syncedWorkflow } }));
  },
);
