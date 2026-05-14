import { atom } from 'jotai';

import {
  createEvaluationProfile,
  getEvaluationProfile,
  getEvaluationWorkflowTemplate,
  patchEvaluationProfile,
} from '@/api/evaluation-profiles';
import { defaultNewName } from '@/lib/default-new-name';
import { EMPTY_WORKFLOW, parsePersistedWorkflowGraphPayload } from '@/components/workflow-graph/reactflow/serialize';
import type { WorkflowGraphPersisted } from '@/components/workflow-graph/reactflow/types';
import { listAtoms } from '@/models/evaluation-profile/list-detail.atom';
import {
  adjustLoadingDepthAtom,
  cancelEditorAtom,
  errorAtom,
  isEditingAtom,
  selectedIdAtom,
} from '@/models/evaluation-profile/scope.atom';

/** 与 {@link errorAtom} 中保存失败文案前缀一致，便于区分初始化错误与保存错误 */
export const SUBMIT_ERROR_PREFIX = '无法保存：' as const;

export type FormState = {
  submitting: boolean;
  name: string;
  description: string;
  workflow: WorkflowGraphPersisted;
};

/** 当前唯一一份编辑草稿（任意时刻仅允许编辑一个评价方案）。 */
export const formStateAtom = atom<FormState>({
  submitting: false,
  name: '',
  description: '',
  workflow: EMPTY_WORKFLOW,
});

export const initFormAtom = atom(null, async (_get, set, id?: string | null) => {
  const isEdit = Boolean(id);

  set(errorAtom, null);
  set(adjustLoadingDepthAtom, 1);
  try {
    if (isEdit && id) {
      try {
        const d = await getEvaluationProfile(id);
        set(formStateAtom, (s) => ({
          ...s,
          name: d.name,
          description: d.description,
          workflow: d.workflow,
        }));
        set(errorAtom, null);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        set(errorAtom, msg);
      }
      return;
    }

    try {
      const raw = await getEvaluationWorkflowTemplate();
      const workflow = parsePersistedWorkflowGraphPayload(raw);
      set(formStateAtom, (s) => ({
        ...s,
        name: s.name.trim() ? s.name : defaultNewName('新评价方案'),
        workflow,
      }));
      set(errorAtom, null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set(errorAtom, msg);
      set(formStateAtom, (s) => ({
        ...s,
        name: s.name.trim() ? s.name : defaultNewName('新评价方案'),
        workflow: EMPTY_WORKFLOW,
      }));
    }
  } finally {
    set(adjustLoadingDepthAtom, -1);
  }
});

export const setFormNameAtom = atom(null, (_get, set, name: string) => {
  set(formStateAtom, (s) => ({ ...s, name }));
});

export const setFormDescriptionAtom = atom(null, (_get, set, description: string) => {
  set(formStateAtom, (s) => ({ ...s, description }));
});

export const setFormWorkflowAtom = atom(null, (_get, set, workflow: WorkflowGraphPersisted) => {
  set(formStateAtom, (s) => ({ ...s, workflow }));
});

export const submitFormAtom = atom(
  null,
  async (get, set, payload: { id?: string | null; workflow: WorkflowGraphPersisted }) => {
    const { id, workflow } = payload;
    const isEdit = Boolean(id);
    const s = get(formStateAtom);

    set(errorAtom, null);
    set(formStateAtom, (st) => ({ ...st, submitting: true }));
    try {
      if (isEdit) {
        if (!id) throw new Error('无效 id');
        const saved = await patchEvaluationProfile(id, {
          name: s.name.trim(),
          description: s.description.trim(),
          workflow,
        });
        set(formStateAtom, (st) => ({ ...st, submitting: false }));
        return saved.id;
      }
      const created = await createEvaluationProfile({
        name: s.name.trim(),
        description: s.description.trim(),
        workflow,
      });
      set(formStateAtom, (st) => ({ ...st, submitting: false }));
      return created.id;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set(errorAtom, `${SUBMIT_ERROR_PREFIX}${msg}`);
      set(formStateAtom, (st) => ({
        ...st,
        submitting: false,
      }));
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
  const formState = get(formStateAtom);
  const getLive = get(editorGetLiveWorkflowAtom);
  const workflow = getLive?.() ?? formState.workflow;

  const savedId = await set(submitFormAtom, {
    id: isCreate ? null : sid,
    workflow,
  });
  if (!savedId) return;

  set(cancelEditorAtom);
  set(selectedIdAtom, savedId);
  set(listAtoms.refreshAtom);
});
