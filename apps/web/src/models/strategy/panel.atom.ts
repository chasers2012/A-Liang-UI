import { atom } from 'jotai';
import { atomEffect } from 'jotai-effect';

import { strategiesListAtoms } from '@/models/strategy/list-detail.atom';

/** 左侧当前选中的策略 id；新建时为 null */
export const strategiesPanelSelectedIdAtom = atom<string | null>(null);

/** 右侧是否为编辑态（含「新建策略」） */
export const strategiesPanelIsEditingAtom = atom<boolean>(false);

/** 查看态：描述 / 工作流 */
export type StrategiesPanelViewTab = 'description' | 'workflow';
export const strategiesPanelViewTabAtom = atom<StrategiesPanelViewTab>('description');

/** 编辑态：基础信息 / 工作流 */
export type StrategiesPanelEditTab = 'meta' | 'workflow';
export const strategiesPanelEditTabAtom = atom<StrategiesPanelEditTab>('meta');

export const selectStrategyFromListAtom = atom(null, (_get, set, itemId: string) => {
  set(strategiesPanelSelectedIdAtom, itemId);
  set(strategiesPanelIsEditingAtom, false);
});

export const startCreateStrategyAtom = atom(null, (_get, set) => {
  set(strategiesPanelSelectedIdAtom, null);
  set(strategiesPanelIsEditingAtom, true);
  set(strategiesPanelEditTabAtom, 'meta');
});

export const enterStrategyEditorAtom = atom(null, (_get, set) => {
  set(strategiesPanelIsEditingAtom, true);
  set(strategiesPanelEditTabAtom, 'meta');
});

export const cancelStrategyEditorAtom = atom(null, (_get, set) => {
  set(strategiesPanelIsEditingAtom, false);
});

/** 进入策略页时刷新列表 */
export const strategiesListRefreshOnMountEffectAtom = atomEffect((_get, set) => {
  void set(strategiesListAtoms.refreshAtom);
});
