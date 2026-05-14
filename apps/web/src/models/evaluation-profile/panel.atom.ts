import { atom } from 'jotai';

/** 左侧当前选中的评价方案 id；新建时为 null */
export const evaluationProfilesPanelSelectedIdAtom = atom<string | null>(null);

/** 右侧是否为编辑态（含「新建方案」） */
export const evaluationProfilesPanelIsEditingAtom = atom<boolean>(false);

/** 评价方案页右侧统一错误文案（详情加载、表单初始化/保存、节点目录等） */
export const evaluationProfilesPanelErrorAtom = atom<string | null>(null);

const evaluationProfilesPanelLoadingDepthAtom = atom(0);

/** 与详情拉取、表单初始化配对：+1 开始，-1 结束，支持并发 */
export const adjustEvaluationProfilesPanelLoadingDepthAtom = atom(null, (_get, set, delta: number) => {
  set(evaluationProfilesPanelLoadingDepthAtom, (n) => Math.max(0, n + delta));
});

/** 评价方案页右侧统一加载中（深度大于 0） */
export const evaluationProfilesPanelLoadingAtom = atom((get) => get(evaluationProfilesPanelLoadingDepthAtom) > 0);

export const selectEvaluationProfileFromListAtom = atom(null, (_get, set, itemId: string) => {
  set(evaluationProfilesPanelSelectedIdAtom, itemId);
  set(evaluationProfilesPanelIsEditingAtom, false);
  set(evaluationProfilesPanelErrorAtom, null);
  set(evaluationProfilesPanelLoadingDepthAtom, 0);
});

export const startCreateEvaluationProfileAtom = atom(null, (_get, set) => {
  set(evaluationProfilesPanelSelectedIdAtom, null);
  set(evaluationProfilesPanelIsEditingAtom, true);
  set(evaluationProfilesPanelErrorAtom, null);
  set(evaluationProfilesPanelLoadingDepthAtom, 0);
});

export const enterEvaluationProfileEditorAtom = atom(null, (_get, set) => {
  set(evaluationProfilesPanelIsEditingAtom, true);
  set(evaluationProfilesPanelErrorAtom, null);
  set(evaluationProfilesPanelLoadingDepthAtom, 0);
});

export const cancelEvaluationProfileEditorAtom = atom(null, (_get, set) => {
  set(evaluationProfilesPanelIsEditingAtom, false);
  set(evaluationProfilesPanelErrorAtom, null);
  set(evaluationProfilesPanelLoadingDepthAtom, 0);
});
