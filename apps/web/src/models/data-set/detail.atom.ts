import { atom } from 'jotai';
import { atomFamily } from 'jotai-family';

import type { WorkflowGraphPersisted } from '@/components/workflow-graph/reactflow/types';
import { createDataSet, getDataSet, patchDataSet } from '@/api/data-sets';
import { ApiError } from '@/api/client';
import { toAsyncValueStateAtom } from '@/lib/loadable';
import type { DataSetPublic } from '@/models/data-set/dto';
import {
  parseInstrumentCodesFromText,
  validateDataSetBindings,
  validatePreprocessingWorkflow,
  type DataSetFormState,
} from '@/models/data-set/form-logic';
import { dataSetAtoms } from '@/models/data-set/panel-detail.atom';
import { dataSetsSelectedIdAtom } from '@/models/data-set/selection.atom';

export const dataSetDetailRevisionAtomFamily = atomFamily((key: string) => {
  void key;
  return atom(0);
});

export const dataSetDetailAsyncAtomFamily = atomFamily((dataSetId: string | null) =>
  atom(async (get): Promise<DataSetPublic | null> => {
    get(dataSetDetailRevisionAtomFamily(dataSetId ?? ''));
    const id = (dataSetId ?? '').trim();
    if (!id) return null;
    return await getDataSet(id);
  }),
);

export const dataSetDetailAsyncStateAtomFamily = atomFamily((dataSetId: string | null) =>
  toAsyncValueStateAtom(dataSetDetailAsyncAtomFamily(dataSetId)),
);

export const refreshDataSetDetailAtomFamily = atomFamily((key: string) =>
  atom(null, (_get, set) => {
    set(dataSetDetailRevisionAtomFamily(key), (v) => v + 1);
  }),
);

/** Convenience selector: current selected dataset detail (or null). */
export const selectedDataSetDetailAtom = atom((get) => {
  const selectedId = get(dataSetsSelectedIdAtom);
  const detailState = get(dataSetDetailAsyncStateAtomFamily(selectedId));
  return detailState.value ?? null;
});

/**
 * 创建 / 更新数据集（与 {@link saveNodesDetailAtomFamily} 同级：API + 刷新列表；详情 revision 由 {@link dataSetsAfterSaveAtom} bump）。
 * 校验或网络失败时抛错，由 {@link handleSaveDataSetEditorAtom} 捕获并写入 formError。
 */
export const saveDataSetDetailAtom = atom(
  null,
  async (
    get,
    set,
    input: {
      dataSetId: string;
      form: DataSetFormState;
      workflowOverride?: WorkflowGraphPersisted | null;
    },
  ): Promise<string | null> => {
    const id = input.dataSetId.trim();
    const { form } = input;
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

    try {
      const createdOrId = !id ? await createDataSet(payload) : await patchDataSet(id, payload).then(() => ({ id }));
      set(dataSetAtoms.refreshAtom);
      await get(dataSetAtoms.asyncAtom);
      return createdOrId.id;
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : String(err);
      throw new Error(msg);
    }
  },
);
