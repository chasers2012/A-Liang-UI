import { atom } from 'jotai';

import { createEvaluationProfile, patchEvaluationProfile } from '@/api/evaluation-profiles';
import { defaultNewName } from '@/lib/default-new-name';
import { EMPTY_WORKFLOW } from '@/components/workflow-graph/reactflow/serialize';
import type { WorkflowGraphPersisted } from '@/components/workflow-graph/reactflow/types';
import { evaluationWorkflowTemplateAsyncAtom } from '@/models/evaluation-profile/evaluation-workflow-template.atom';
import { detailAtomFamily, listAtoms } from '@/models/evaluation-profile/list-detail.atom';
import {
  cancelEditorAtom,
  errorAtom,
  isEditingAtom,
  loadingAtom,
  selectedIdAtom,
} from '@/models/evaluation-profile/scope.atom';

/** 与 {@link errorAtom} 中保存失败文案前缀一致，便于区分初始化错误与保存错误 */
export const SUBMIT_ERROR_PREFIX = '无法保存：' as const;

/** 当前唯一一份编辑草稿：是否正在提交保存。 */
export const formSubmittingAtom = atom(false);

/** 当前唯一一份编辑草稿：名称。 */
export const formNameAtom = atom('');

/** 当前唯一一份编辑草稿：描述。 */
export const formDescriptionAtom = atom('');

/** 当前唯一一份编辑草稿：工作流图（任意时刻仅允许编辑一个评价方案）。 */
export const formWorkflowAtom = atom<WorkflowGraphPersisted>(EMPTY_WORKFLOW);

export const initFormAtom = atom(null, async (get, set, id?: string | null) => {
  set(errorAtom, null);
  set(loadingAtom, true);
  try {
    if (id) {
      const row = get(detailAtomFamily(id));
      if (row) {
        set(formNameAtom, row.name);
        set(formDescriptionAtom, row.description);
        set(formWorkflowAtom, row.workflow);
        set(errorAtom, null);
      } else {
        set(errorAtom, '评价方案详情尚未加载，请稍后再试或返回后重新进入编辑。');
      }
      return;
    }

    try {
      const workflow = await get(evaluationWorkflowTemplateAsyncAtom);
      const name = get(formNameAtom);
      set(formNameAtom, name.trim() ? name : defaultNewName('新评价方案'));
      set(formWorkflowAtom, workflow);
      set(errorAtom, null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set(errorAtom, msg);
      const name = get(formNameAtom);
      set(formNameAtom, name.trim() ? name : defaultNewName('新评价方案'));
      set(formWorkflowAtom, EMPTY_WORKFLOW);
    }
  } finally {
    set(loadingAtom, false);
  }
});

export const submitFormAtom = atom(
  null,
  async (get, set, payload: { id?: string | null; workflow: WorkflowGraphPersisted }) => {
    const { id, workflow } = payload;
    const isEdit = Boolean(id);
    const name = get(formNameAtom);
    const description = get(formDescriptionAtom);

    set(errorAtom, null);
    set(formSubmittingAtom, true);
    try {
      if (isEdit) {
        if (!id) throw new Error('无效 id');
        const saved = await patchEvaluationProfile(id, {
          name: name.trim(),
          description: description.trim(),
          workflow,
        });
        set(formSubmittingAtom, false);
        return saved.id;
      }
      const created = await createEvaluationProfile({
        name: name.trim(),
        description: description.trim(),
        workflow,
      });
      set(formSubmittingAtom, false);
      return created.id;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set(errorAtom, `${SUBMIT_ERROR_PREFIX}${msg}`);
      set(formSubmittingAtom, false);
      return null;
    }
  },
);

/** 编辑会话中由外部注册；提交保存时若存在则优先采用其返回的工作流图，否则使用表单内草稿。 */
export const editorGetLiveWorkflowAtom = atom<(() => WorkflowGraphPersisted | null) | null>(null);

export const commitEditorAtom = atom(null, async (get, set) => {
  if (!get(isEditingAtom)) return;

  const sid = get(selectedIdAtom);
  const isCreate = sid == null;
  const getLive = get(editorGetLiveWorkflowAtom);
  const workflow = getLive?.() ?? get(formWorkflowAtom);

  const savedId = await set(submitFormAtom, {
    id: isCreate ? null : sid,
    workflow,
  });
  if (!savedId) return;

  set(cancelEditorAtom);
  set(selectedIdAtom, savedId);
  set(listAtoms.refreshAtom);
});
