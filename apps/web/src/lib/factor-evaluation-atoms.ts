import { atom } from "jotai";

/** 当前正在执行 POST /evaluations/run 的因子（全应用单例，避免并发重复跑） */
export type FactorEvaluationRunning = {
  factorId: string;
  factorName: string;
};

export const factorEvaluationRunningAtom = atom<FactorEvaluationRunning | null>(
  null,
);
