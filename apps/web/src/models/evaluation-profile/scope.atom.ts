import { atom } from 'jotai';

/** 当前选中的评价方案 id；新建尚未落库时为 null。 */
export const selectedIdAtom = atom<string | null>(null);

/** 是否处于表单编辑会话（含新建）。 */
export const isEditingAtom = atom<boolean>(false);

/** 模块内统一错误文案（详情加载、表单初始化与保存、节点类型清单拉取等）。 */
export const errorAtom = atom<string | null>(null);

const loadingDepthAtom = atom(0);

/** 与异步详情拉取、表单初始化等配对：+1 开始，-1 结束，支持并发。 */
export const adjustLoadingDepthAtom = atom(null, (_get, set, delta: number) => {
  set(loadingDepthAtom, (n) => Math.max(0, n + delta));
});

/** 是否存在进行中的上述异步操作（深度大于 0）。 */
export const loadingAtom = atom((get) => get(loadingDepthAtom) > 0);

export const selectProfileAtom = atom(null, (_get, set, id: string) => {
  set(selectedIdAtom, id);
  set(isEditingAtom, false);
  set(errorAtom, null);
  set(loadingDepthAtom, 0);
});

export const startCreateAtom = atom(null, (_get, set) => {
  set(selectedIdAtom, null);
  set(isEditingAtom, true);
  set(errorAtom, null);
  set(loadingDepthAtom, 0);
});

export const enterEditorAtom = atom(null, (_get, set) => {
  set(isEditingAtom, true);
  set(errorAtom, null);
  set(loadingDepthAtom, 0);
});

export const cancelEditorAtom = atom(null, (_get, set) => {
  set(isEditingAtom, false);
  set(errorAtom, null);
  set(loadingDepthAtom, 0);
});
