import { atom } from 'jotai';

import { dataSetsSelectedIdAtom } from '@/models/data-set/selection.atom';

/** 右侧主区域是否为编辑表单（false=详情，true=编辑；新建=true+selectedId=null） */
export const dataSetsIsEditingAtom = atom<boolean>(false);

/** 选中列表项并进入详情 */
export const dataSetsSelectAndDetailAtom = atom(null, (_get, set, id: string) => {
  set(dataSetsSelectedIdAtom, id);
  set(dataSetsIsEditingAtom, false);
});

/** 进入新建（对齐节点页「选中清空 + 进入新建」） */
export const dataSetsEnterCreateAtom = atom(null, (_get, set) => {
  set(dataSetsSelectedIdAtom, null);
  set(dataSetsIsEditingAtom, true);
});

/** 当前已选中 id 时进入编辑 */
export const dataSetsEnterEditAtom = atom(null, (get, set) => {
  const id = get(dataSetsSelectedIdAtom);
  if (!id?.trim()) return;
  set(dataSetsIsEditingAtom, true);
});

/** 取消表单回到详情（保留选中 id；新建时 id 本就为 null） */
export const dataSetsExitFormToDetailAtom = atom(null, (_get, set) => {
  set(dataSetsIsEditingAtom, false);
});

/** 保存成功：选中该数据集并回到详情 */
export const dataSetsAfterSaveAtom = atom(null, (_get, set, id: string) => {
  set(dataSetsSelectedIdAtom, id);
  set(dataSetsIsEditingAtom, false);
});

/** 删除后清空选中并回详情 */
export const dataSetsAfterDeletedAtom = atom(null, (_get, set) => {
  set(dataSetsSelectedIdAtom, null);
  set(dataSetsIsEditingAtom, false);
});
