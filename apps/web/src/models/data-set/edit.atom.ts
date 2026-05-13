import { atom } from 'jotai';

import type { WorkflowGraphPersisted } from '@/components/workflow-graph/reactflow/types';
import { defaultNewName } from '@/lib/default-new-name';
import {
  dataSetDetailAsyncAtomFamily,
  refreshDataSetDetailAtomFamily,
  saveDataSetDetailAtom,
} from '@/models/data-set/detail.atom';
import { dataSetEditorDatasourcesAsyncAtom } from '@/models/data-set/editor/datasources.atom';
import {
  dataSetEditorHydrateTickAtom,
  dataSetEditorStateAtom,
  resetDataSetEditorState,
} from '@/models/data-set/editor/form-state.atom';
import { dataSetWorkflowTemplateAsyncAtom } from '@/models/data-set/editor/workflow-template.atom';
import { emptyDataSetForm, hydrateDataSetForm } from '@/models/data-set/form-logic';
import { dataSetsSelectedIdAtom } from '@/models/data-set/selection.atom';

/** 与节点页 {@link nodesEditingAtom} 一致：读写分离，便于在 atomEffect 中订阅。 */
const dataSetsEditingStateAtom = atom(false);
export const dataSetsEditingAtom = atom(
  (get) => get(dataSetsEditingStateAtom),
  (_get, set, next: boolean) => {
    set(dataSetsEditingStateAtom, next);
  },
);

/** 详情卡 tab（迁入 edit，与节点页的编辑态 UI 状态同层管理） */
export type DataSetDetailPanelTab = 'detail' | 'preprocessing' | 'preview';
export const dataSetDetailPanelActiveTabAtom = atom<DataSetDetailPanelTab>('detail');

/** 保存成功后：刷新详情 revision、选中 id、退出编辑、回到「详情」tab */
export const dataSetsAfterSaveAtom = atom(null, (_get, set, id: string) => {
  const key = id.trim();
  if (key) void set(refreshDataSetDetailAtomFamily(key));
  set(dataSetsSelectedIdAtom, id);
  set(dataSetsEditingAtom, false);
  set(dataSetDetailPanelActiveTabAtom, 'detail');
});

/**
 * 进入编辑态时加载表单（详情由 {@link dataSetDetailAsyncAtomFamily} 维护，此处仅初始化编辑草稿）。
 */
export const prepareDataSetEditorAtom = atom(
  null,
  async (get, set, input: { isEditing: boolean; dataSetId: string }) => {
    const { isEditing, dataSetId: rawId } = input;
    const id = (rawId ?? '').trim();
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
        const row = await get(dataSetDetailAsyncAtomFamily(id));
        if (!row) throw new Error('记录已不存在');
        set(dataSetEditorStateAtom, (s) => ({
          ...s,
          editorLoading: false,
          editorLoadError: null,
          form: hydrateDataSetForm(row),
        }));
        set(dataSetEditorHydrateTickAtom, (v) => v + 1);
        return;
      }

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
  },
);

/** 对齐 {@link handleSaveNodesDetailAtom}：防重入、调 {@link saveDataSetDetailAtom}、成功后收尾。 */
export const handleSaveDataSetEditorAtom = atom(
  null,
  async (get, set, input?: { dataSetId: string; workflowOverride?: WorkflowGraphPersisted | null }) => {
    const dataSetId = (input?.dataSetId ?? get(dataSetsSelectedIdAtom) ?? '').trim();
    const submitting = get(dataSetEditorStateAtom).submitting;
    if (submitting) return null;

    const { form } = get(dataSetEditorStateAtom);
    set(dataSetEditorStateAtom, (s) => ({ ...s, submitting: true, formError: null }));

    let savedId: string | null = null;
    try {
      savedId = await set(saveDataSetDetailAtom, {
        dataSetId,
        form,
        workflowOverride: input?.workflowOverride,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set(dataSetEditorStateAtom, (s) => ({ ...s, submitting: false, formError: msg }));
      return null;
    }

    set(dataSetEditorStateAtom, (s) => ({ ...s, submitting: false }));

    if (!savedId) {
      set(dataSetEditorStateAtom, (s) => ({ ...s, formError: s.formError ?? '保存失败' }));
      return null;
    }

    void set(dataSetsAfterSaveAtom, savedId);
    return savedId;
  },
);

/** 对齐 {@link handleCancelNodesEditAtom}：退出编辑并重置草稿。 */
export const handleCancelDataSetEditAtom = atom(null, (_get, set) => {
  set(dataSetEditorStateAtom, resetDataSetEditorState());
  set(dataSetsEditingAtom, false);
  set(dataSetDetailPanelActiveTabAtom, 'detail');
});
