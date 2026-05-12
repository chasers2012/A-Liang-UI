import { atom } from 'jotai';

import type { WorkflowGraphPersisted } from '@/components/workflow-graph/reactflow/types';
import { defaultNewName } from '@/lib/default-new-name';
import { createDataSet, getDataSet, patchDataSet } from '@/api/data-sets';
import { ApiError } from '@/api/client';
import { dataSetAtoms } from '@/models/data-set/panel-detail.atom';
import { dataSetsAfterSaveAtom } from '@/models/data-set/panel-ui.atom';
import { syncSystemPreprocessingWorkflow } from '@/app/data/data-sets/components/panel/system-preprocessing-node-types';

import { dataSetWorkflowTemplateAsyncAtom } from './workflow-template.atom';
import { dataSetEditorDatasourcesAsyncAtom } from './datasources.atom';
import {
  emptyDataSetForm,
  hydrateDataSetForm,
  parseInstrumentCodesFromText,
  sameWorkflowGraph,
  validateDataSetBindings,
  validatePreprocessingWorkflow,
  type DataSetBindingFormRow,
  type DataSetFormState,
} from '../form-logic';

export type DataSetEditorState = {
  editorLoading: boolean;
  editorLoadError: string | null;
  submitting: boolean;
  formError: string | null;
  form: DataSetFormState;
};

function initialEditorState(): DataSetEditorState {
  return {
    editorLoading: false,
    editorLoadError: null,
    submitting: false,
    formError: null,
    form: emptyDataSetForm(),
  };
}

export const dataSetEditorStateAtom = atom<DataSetEditorState>(initialEditorState());

/**
 * Tick that bumps whenever editor hydration completes (useful for forcing canvas remount in UI).
 * UI can keep `canvasKey` locally and increment when this value changes.
 */
export const dataSetEditorHydrateTickAtom = atom(0);

export const initDataSetEditorAtom = atom(null, async (get, set, input: { isEditing: boolean; dataSetId: string }) => {
  const isEditing = input.isEditing;
  const id = (input.dataSetId ?? '').trim();
  if (!isEditing) return;

  set(dataSetEditorStateAtom, (s) => ({
    ...s,
    editorLoading: Boolean(id),
    editorLoadError: null,
    formError: null,
  }));

  try {
    const [datasources, template] = await Promise.all([
      get(dataSetEditorDatasourcesAsyncAtom),
      get(dataSetWorkflowTemplateAsyncAtom),
    ]);
    void datasources;

    if (id) {
      const row = await getDataSet(id);
      set(dataSetEditorStateAtom, (s) => ({
        ...s,
        editorLoading: false,
        editorLoadError: null,
        form: hydrateDataSetForm(row),
      }));
      set(dataSetEditorHydrateTickAtom, (v) => v + 1);
      return;
    }

    // Create: keep user's typed fields when toggling modes.
    set(dataSetEditorStateAtom, (s) => ({
      ...s,
      editorLoading: false,
      editorLoadError: null,
      form: {
        ...emptyDataSetForm(template),
        name: s.form.name.trim() ? s.form.name : defaultNewName('新数据集'),
        description: s.form.description,
        start: s.form.start,
        end: s.form.end,
        instrument_codes_text: s.form.instrument_codes_text,
      },
    }));
    set(dataSetEditorHydrateTickAtom, (v) => v + 1);
  } catch (e) {
    set(dataSetEditorStateAtom, (s) => ({
      ...s,
      editorLoading: false,
      editorLoadError: e instanceof Error ? e.message : String(e),
    }));
  }
});

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

export const submitDataSetEditorAtom = atom(
  null,
  async (get, set, input: { dataSetId: string; workflowOverride?: WorkflowGraphPersisted | null }) => {
    const id = (input.dataSetId ?? '').trim();
    const { form } = get(dataSetEditorStateAtom);

    set(dataSetEditorStateAtom, (s) => ({ ...s, submitting: true, formError: null }));

    try {
      const name = form.name.trim();
      if (!name) throw new Error('名称不能为空');

      const bindingsError = validateDataSetBindings(form.bindings);
      if (bindingsError) throw new Error(bindingsError);

      const wf = input.workflowOverride ?? form.preprocessing_workflow;
      const wfError = validatePreprocessingWorkflow(wf);
      if (wfError) throw new Error(wfError);

      const instrument_codes = parseInstrumentCodesFromText(form.instrument_codes_text);
      const datasource_bindings = form.bindings.map((b) => ({
        datasource_id: b.datasource_id.trim(),
        columns: (b.columns ?? []).map((c) => c.trim()).filter(Boolean),
      }));

      const payload = {
        name,
        description: form.description.trim(),
        datasource_bindings,
        preprocessing_workflow: wf,
        start: form.start.trim(),
        end: form.end.trim(),
        instrument_codes,
      };

      const createdOrId = !id ? await createDataSet(payload) : await patchDataSet(id, payload).then(() => ({ id }));
      set(dataSetAtoms.refreshAtom);
      set(dataSetsAfterSaveAtom, createdOrId.id);

      set(dataSetEditorStateAtom, (s) => ({ ...s, submitting: false }));
      return createdOrId.id;
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : String(err);
      set(dataSetEditorStateAtom, (s) => ({ ...s, submitting: false, formError: msg }));
      return null;
    }
  },
);

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
