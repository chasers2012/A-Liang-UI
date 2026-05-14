import { atom } from 'jotai';

import { formStateAtom, setFormDescriptionAtom } from '@/models/evaluation-profile/form.atom';
import { detailAtomFamily } from '@/models/evaluation-profile/list-detail.atom';
import { isEditingAtom, selectedIdAtom } from '@/models/evaluation-profile/scope.atom';

/**
 * 远程数据层：详情拉取后的描述（只读来源）。
 * 无选中 id 时为空字符串。
 */
export const metaRemoteDescriptionAtom = atom((get) => {
  const sid = get(selectedIdAtom);
  if (sid == null) return '';
  return get(detailAtomFamily(sid)).row?.description ?? '';
});

/**
 * 本地修改层：表单草稿中的描述（与 {@link formStateAtom} 一致）。
 */
export const metaLocalDescriptionAtom = atom((get) => get(formStateAtom).description);

/** 合并描述：编辑会话中取表单草稿，否则取详情远程数据。 */
export const mergedDescriptionAtom = atom((get) => {
  const editing = get(isEditingAtom);
  const local = get(metaLocalDescriptionAtom);
  const remote = get(metaRemoteDescriptionAtom);
  return editing ? local : remote;
});

/** 仅在编辑会话中写入表单；非编辑时不应产生变更。 */
export const setMetaDescriptionAtom = atom(null, (get, set, description: string) => {
  if (!get(isEditingAtom)) return;
  set(setFormDescriptionAtom, description);
});
