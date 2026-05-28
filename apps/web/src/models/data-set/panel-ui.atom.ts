import { atom } from 'jotai';

import {
  dataSetsEditingAtom,
  dataSetDetailPanelActiveTabAtom,
  handleCancelDataSetEditAtom,
} from '@/models/data-set/edit.atom';
import { dataSetsSelectedIdAtom } from '@/models/data-set/selection.atom';

export {
  dataSetsEditingAtom as dataSetsIsEditingAtom,
  dataSetDetailPanelActiveTabAtom,
  type DataSetDetailPanelTab,
  dataSetsAfterSaveAtom,
} from '@/models/data-set/edit.atom';

/** 选中列表项并进入详情 */
export const dataSetsSelectAndDetailAtom = atom(null, (_get, set, id: string) => {
  set(dataSetsSelectedIdAtom, id);
  set(dataSetsEditingAtom, false);
  set(dataSetDetailPanelActiveTabAtom, 'detail');
});

/** 进入新建（对齐节点页「选中清空 + 进入新建」） */
export const dataSetsEnterCreateAtom = atom(null, (_get, set) => {
  set(dataSetsSelectedIdAtom, null);
  set(dataSetsEditingAtom, true);
  set(dataSetDetailPanelActiveTabAtom, 'detail');
});

/** 当前已选中 id 时进入编辑 */
export const dataSetsEnterEditAtom = atom(null, (get, set) => {
  const sid = get(dataSetsSelectedIdAtom);
  if (!sid?.trim()) return;
  set(dataSetsEditingAtom, true);
  set(dataSetDetailPanelActiveTabAtom, 'detail');
});

/** 取消表单回到详情（保留选中 id；新建时 id 本就为 null） */
export const dataSetsExitFormToDetailAtom = atom(null, (_get, set) => {
  void set(handleCancelDataSetEditAtom);
});

/** 删除后清空选中并回详情 */
export const dataSetsAfterDeletedAtom = atom(null, (_get, set) => {
  set(dataSetsSelectedIdAtom, null);
  set(dataSetsEditingAtom, false);
  set(dataSetDetailPanelActiveTabAtom, 'detail');
});
