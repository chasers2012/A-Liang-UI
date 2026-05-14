import { atom } from 'jotai';
import { atomFamily } from 'jotai-family';

import {
  createEvaluationProfile,
  getEvaluationProfile,
  getEvaluationWorkflowTemplate,
  patchEvaluationProfile,
} from '@/api/evaluation-profiles';
import { defaultNewName } from '@/lib/default-new-name';
import { EMPTY_WORKFLOW, parsePersistedWorkflowGraphPayload } from '@/components/workflow-graph/reactflow/serialize';
import type { WorkflowGraphPersisted } from '@/components/workflow-graph/reactflow/types';
import { evaluationProfilesListAtoms } from '@/models/evaluation-profile/list-detail.atom';
import {
  adjustEvaluationProfilesPanelLoadingDepthAtom,
  cancelEvaluationProfileEditorAtom,
  evaluationProfilesPanelErrorAtom,
  evaluationProfilesPanelIsEditingAtom,
  evaluationProfilesPanelSelectedIdAtom,
} from '@/models/evaluation-profile/panel.atom';

/** 与 {@link evaluationProfilesPanelErrorAtom} 中保存失败文案前缀一致，供 UI 区分初始化错误与保存错误 */
export const EVALUATION_PROFILE_SUBMIT_ERROR_PREFIX = '无法保存：' as const;

export type EvaluationProfileFormState = {
  submitting: boolean;
  name: string;
  description: string;
  workflow: WorkflowGraphPersisted;
};

export const evaluationProfileFormStateAtomFamily = atomFamily((key: string | null) => {
  void key;
  return atom<EvaluationProfileFormState>({
    submitting: false,
    name: '',
    description: '',
    workflow: EMPTY_WORKFLOW,
  });
});

export const initEvaluationProfileFormAtomFamily = atomFamily((key: string | null) =>
  atom(null, async (_get, set, id?: string | null) => {
    const isEdit = Boolean(id);

    set(evaluationProfilesPanelErrorAtom, null);
    set(adjustEvaluationProfilesPanelLoadingDepthAtom, 1);
    try {
      if (isEdit && id) {
        try {
          const d = await getEvaluationProfile(id);
          set(evaluationProfileFormStateAtomFamily(key), (s) => ({
            ...s,
            name: d.name,
            description: d.description,
            workflow: d.workflow,
          }));
          set(evaluationProfilesPanelErrorAtom, null);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          set(evaluationProfilesPanelErrorAtom, msg);
        }
        return;
      }

      try {
        const raw = await getEvaluationWorkflowTemplate();
        const workflow = parsePersistedWorkflowGraphPayload(raw);
        set(evaluationProfileFormStateAtomFamily(key), (s) => ({
          ...s,
          name: s.name.trim() ? s.name : defaultNewName('新评价方案'),
          workflow,
        }));
        set(evaluationProfilesPanelErrorAtom, null);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        set(evaluationProfilesPanelErrorAtom, msg);
        set(evaluationProfileFormStateAtomFamily(key), (s) => ({
          ...s,
          name: s.name.trim() ? s.name : defaultNewName('新评价方案'),
          workflow: EMPTY_WORKFLOW,
        }));
      }
    } finally {
      set(adjustEvaluationProfilesPanelLoadingDepthAtom, -1);
    }
  }),
);

export const setEvaluationProfileFormNameAtomFamily = atomFamily((key: string | null) =>
  atom(null, (_get, set, name: string) => {
    set(evaluationProfileFormStateAtomFamily(key), (s) => ({ ...s, name }));
  }),
);

export const setEvaluationProfileFormDescriptionAtomFamily = atomFamily((key: string | null) =>
  atom(null, (_get, set, description: string) => {
    set(evaluationProfileFormStateAtomFamily(key), (s) => ({ ...s, description }));
  }),
);

export const setEvaluationProfileFormWorkflowAtomFamily = atomFamily((key: string | null) =>
  atom(null, (_get, set, workflow: WorkflowGraphPersisted) => {
    set(evaluationProfileFormStateAtomFamily(key), (s) => ({ ...s, workflow }));
  }),
);

export const submitEvaluationProfileFormAtomFamily = atomFamily((key: string | null) =>
  atom(null, async (get, set, payload: { id?: string | null; workflow: WorkflowGraphPersisted }) => {
    const { id, workflow } = payload;
    const isEdit = Boolean(id);
    const s = get(evaluationProfileFormStateAtomFamily(key));

    set(evaluationProfilesPanelErrorAtom, null);
    set(evaluationProfileFormStateAtomFamily(key), (st) => ({ ...st, submitting: true }));
    try {
      if (isEdit) {
        if (!id) throw new Error('无效 id');
        const saved = await patchEvaluationProfile(id, {
          name: s.name.trim(),
          description: s.description.trim(),
          workflow,
        });
        set(evaluationProfileFormStateAtomFamily(key), (st) => ({ ...st, submitting: false }));
        return saved.id;
      }
      const created = await createEvaluationProfile({
        name: s.name.trim(),
        description: s.description.trim(),
        workflow,
      });
      set(evaluationProfileFormStateAtomFamily(key), (st) => ({ ...st, submitting: false }));
      return created.id;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set(evaluationProfilesPanelErrorAtom, `${EVALUATION_PROFILE_SUBMIT_ERROR_PREFIX}${msg}`);
      set(evaluationProfileFormStateAtomFamily(key), (st) => ({
        ...st,
        submitting: false,
      }));
      return null;
    }
  }),
);

/** 编辑态下由详情面板注册，保存时优先取画布当前图 */
export const evaluationProfileEditorGetLiveWorkflowAtom = atom<(() => WorkflowGraphPersisted | null) | null>(null);

export const commitEvaluationProfileEditorAtom = atom(null, async (get, set) => {
  if (!get(evaluationProfilesPanelIsEditingAtom)) return;

  const selectedId = get(evaluationProfilesPanelSelectedIdAtom);
  const isCreate = selectedId == null;
  const formState = get(evaluationProfileFormStateAtomFamily(selectedId));
  const getLive = get(evaluationProfileEditorGetLiveWorkflowAtom);
  const workflow = getLive?.() ?? formState.workflow;

  const savedId = await set(submitEvaluationProfileFormAtomFamily(selectedId), {
    id: isCreate ? null : selectedId,
    workflow,
  });
  if (!savedId) return;

  set(cancelEvaluationProfileEditorAtom);
  set(evaluationProfilesPanelSelectedIdAtom, savedId);
  set(evaluationProfilesListAtoms.refreshAtom);
});
