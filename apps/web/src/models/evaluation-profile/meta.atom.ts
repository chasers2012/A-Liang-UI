import { atom } from 'jotai';

import {
  evaluationProfileFormStateAtomFamily,
  setEvaluationProfileFormDescriptionAtomFamily,
} from '@/models/evaluation-profile/form.atom';
import { evaluationProfileDetailAtomFamily } from '@/models/evaluation-profile/list-detail.atom';
import {
  evaluationProfilesPanelIsEditingAtom,
  evaluationProfilesPanelSelectedIdAtom,
} from '@/models/evaluation-profile/panel.atom';

/**
 * 远程数据层：详情拉取后的描述（只读来源）。
 * 无选中 id 时为空字符串。
 */
export const evaluationProfileMetaRemoteDescriptionAtom = atom((get) => {
  const selectedId = get(evaluationProfilesPanelSelectedIdAtom);
  if (selectedId == null) return '';
  return get(evaluationProfileDetailAtomFamily(selectedId)).row?.description ?? '';
});

/**
 * 本地修改层：表单草稿中的描述（与 {@link evaluationProfileFormStateAtomFamily} 一致）。
 */
export const evaluationProfileMetaLocalDescriptionAtom = atom((get) => {
  const selectedId = get(evaluationProfilesPanelSelectedIdAtom);
  return get(evaluationProfileFormStateAtomFamily(selectedId)).description;
});

export type EvaluationProfileMetaPresentation = {
  /** 合并展示：有编辑上下文时优先本地，否则用远程（同 createRefreshableAsyncAtoms 的 valueAtom 思路） */
  description: string;
  /** 是否展示描述区块：已有远程 row，或新建/编辑态 */
  showSection: boolean;
};

/** 对 UI 暴露的合并只读状态（远程 + 本地） */
export const evaluationProfileMetaPresentationAtom = atom<EvaluationProfileMetaPresentation>((get) => {
  const isEditing = get(evaluationProfilesPanelIsEditingAtom);
  const selectedId = get(evaluationProfilesPanelSelectedIdAtom);
  const local = get(evaluationProfileMetaLocalDescriptionAtom);
  const remote = get(evaluationProfileMetaRemoteDescriptionAtom);
  const { row } = get(evaluationProfileDetailAtomFamily(selectedId ?? ''));
  return {
    description: isEditing ? local : remote,
    showSection: Boolean(row) || isEditing,
  };
});

/** 仅在编辑态写入本地层；只读时不应触发变更 */
export const setEvaluationProfileMetaDescriptionAtom = atom(null, (get, set, description: string) => {
  if (!get(evaluationProfilesPanelIsEditingAtom)) return;
  const selectedId = get(evaluationProfilesPanelSelectedIdAtom);
  set(setEvaluationProfileFormDescriptionAtomFamily(selectedId), description);
});
