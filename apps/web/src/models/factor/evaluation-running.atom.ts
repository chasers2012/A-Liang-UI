import { atom } from "jotai";

/** 当前正在执行评价工作流（POST /evaluation-profiles/evaluations/run）的因子（全应用单例） */
export type FactorEvaluationRunning = {
  factorId: string;
  factorName: string;
};

export const factorEvaluationRunningAtom = atom<FactorEvaluationRunning | null>(
  null,
);
