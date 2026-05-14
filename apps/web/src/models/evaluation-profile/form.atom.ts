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
  cancelEvaluationProfileEditorAtom,
  evaluationProfilesPanelIsEditingAtom,
  evaluationProfilesPanelSelectedIdAtom,
} from '@/models/evaluation-profile/panel.atom';

export type EvaluationProfileFormState = {
  loading: boolean;
  templateLoading: boolean;
  submitting: boolean;
  loadError: string | null;
  formError: string | null;
  name: string;
  description: string;
  workflow: WorkflowGraphPersisted;
};

export const evaluationProfileFormStateAtomFamily = atomFamily((key: string) => {
  void key;
  return atom<EvaluationProfileFormState>({
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

export const initEvaluationProfileFormAtomFamily = atomFamily((key: string) =>
  atom(null, async (_get, set, id?: string | null) => {
    const isEdit = Boolean(id);

    set(evaluationProfileFormStateAtomFamily(key), (s) => ({
      ...s,
      loadError: null,
      formError: null,
      loading: isEdit,
      templateLoading: !isEdit,
    }));

    if (isEdit && id) {
      try {
        const d = await getEvaluationProfile(id);
        set(evaluationProfileFormStateAtomFamily(key), (s) => ({
          ...s,
          loading: false,
          templateLoading: false,
          name: d.name,
          description: d.description,
          workflow: d.workflow,
        }));
      } catch (e) {
        set(evaluationProfileFormStateAtomFamily(key), (s) => ({
          ...s,
          loading: false,
          templateLoading: false,
          loadError: e instanceof Error ? e.message : String(e),
        }));
      }
      return;
    }

    try {
      const raw = await getEvaluationWorkflowTemplate();
      const workflow = parsePersistedWorkflowGraphPayload(raw);
      set(evaluationProfileFormStateAtomFamily(key), (s) => ({
        ...s,
        name: s.name.trim() ? s.name : defaultNewName('新评价方案'),
        templateLoading: false,
        loading: false,
        workflow,
      }));
    } catch (e) {
      set(evaluationProfileFormStateAtomFamily(key), (s) => ({
        ...s,
        name: s.name.trim() ? s.name : defaultNewName('新评价方案'),
        templateLoading: false,
        loading: false,
        loadError: e instanceof Error ? e.message : String(e),
        workflow: EMPTY_WORKFLOW,
      }));
    }
  }),
);

export const setEvaluationProfileFormNameAtomFamily = atomFamily((key: string) =>
  atom(null, (_get, set, name: string) => {
    set(evaluationProfileFormStateAtomFamily(key), (s) => ({ ...s, name }));
  }),
);

export const setEvaluationProfileFormDescriptionAtomFamily = atomFamily((key: string) =>
  atom(null, (_get, set, description: string) => {
    set(evaluationProfileFormStateAtomFamily(key), (s) => ({ ...s, description }));
  }),
);

export const setEvaluationProfileFormWorkflowAtomFamily = atomFamily((key: string) =>
  atom(null, (_get, set, workflow: WorkflowGraphPersisted) => {
    set(evaluationProfileFormStateAtomFamily(key), (s) => ({ ...s, workflow }));
  }),
);

export const submitEvaluationProfileFormAtomFamily = atomFamily((key: string) =>
  atom(null, async (get, set, payload: { id?: string | null; workflow: WorkflowGraphPersisted }) => {
    const { id, workflow } = payload;
    const isEdit = Boolean(id);
    const s = get(evaluationProfileFormStateAtomFamily(key));

    set(evaluationProfileFormStateAtomFamily(key), (st) => ({ ...st, submitting: true, formError: null }));
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
      set(evaluationProfileFormStateAtomFamily(key), (st) => ({
        ...st,
        submitting: false,
        formError: e instanceof Error ? e.message : String(e),
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
  const formKey = isCreate ? '__new__' : selectedId;
  const formState = get(evaluationProfileFormStateAtomFamily(formKey));
  const getLive = get(evaluationProfileEditorGetLiveWorkflowAtom);
  const workflow = getLive?.() ?? formState.workflow;

  const savedId = await set(submitEvaluationProfileFormAtomFamily(formKey), {
    id: isCreate ? null : selectedId,
    workflow,
  });
  if (!savedId) return;

  set(cancelEvaluationProfileEditorAtom);
  set(evaluationProfilesPanelSelectedIdAtom, savedId);
  set(evaluationProfilesListAtoms.refreshAtom);
});
