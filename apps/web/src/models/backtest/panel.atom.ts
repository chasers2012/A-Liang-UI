import { atom } from 'jotai';

import { backtestsCreateModeAtom, backtestsSelectedIdAtom } from './selection.atom';

export const selectBacktestFromListAtom = atom(null, (_get, set, itemId: string) => {
  set(backtestsSelectedIdAtom, itemId);
  set(backtestsCreateModeAtom, false);
});

export const startCreateBacktestAtom = atom(null, (_get, set) => {
  set(backtestsSelectedIdAtom, null);
  set(backtestsCreateModeAtom, true);
});

export const cancelCreateBacktestAtom = atom(null, (_get, set) => {
  set(backtestsCreateModeAtom, false);
});
