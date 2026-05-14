import { atom } from 'jotai';

/** 左侧当前选中的评价方案 id；新建时为 null */
export const evaluationProfilesPanelSelectedIdAtom = atom<string | null>(null);

/** 右侧是否为编辑态（含「新建方案」） */
export const evaluationProfilesPanelIsEditingAtom = atom<boolean>(false);

export const selectEvaluationProfileFromListAtom = atom(null, (_get, set, itemId: string) => {
  set(evaluationProfilesPanelSelectedIdAtom, itemId);
  set(evaluationProfilesPanelIsEditingAtom, false);
});

export const startCreateEvaluationProfileAtom = atom(null, (_get, set) => {
  set(evaluationProfilesPanelSelectedIdAtom, null);
  set(evaluationProfilesPanelIsEditingAtom, true);
});

export const enterEvaluationProfileEditorAtom = atom(null, (_get, set) => {
  set(evaluationProfilesPanelIsEditingAtom, true);
});

export const cancelEvaluationProfileEditorAtom = atom(null, (_get, set) => {
  set(evaluationProfilesPanelIsEditingAtom, false);
});
