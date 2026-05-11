import { atom } from 'jotai';

/** 左侧选中数据集 id；与 `nodesSelectedIdAtom` 对应 */
export const dataSetsSelectedIdAtom = atom<string | null>(null);
