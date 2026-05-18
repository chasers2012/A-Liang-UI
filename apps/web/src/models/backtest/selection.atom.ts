import { atom } from 'jotai';

/** 左侧当前选中的回测 run id */
export const backtestsSelectedIdAtom = atom<string | null>(null);

/** 右侧展示「发起回测」表单 */
export const backtestsCreateModeAtom = atom(false);
