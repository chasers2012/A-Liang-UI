import { atom } from 'jotai';
import type { FactorEvaluationRowPublic, FactorSummaryPublic } from './dto';

export const factorDetailLoadingAtom = atom<boolean>(true);
export const factorDetailLoadErrorAtom = atom<string | null>(null);
export const factorDetailEvalRowAtom = atom<FactorEvaluationRowPublic | null>(null);

export const factorDetailDeleteTargetAtom = atom<FactorSummaryPublic | null>(null);
export const factorDetailDeletingAtom = atom<boolean>(false);
