export type FactorEvalWindow = {
  start?: string | null;
  end?: string | null;
};

export function formatEvaluationWindow(w?: FactorEvalWindow | null): string {
  if (!w || (!String(w.start ?? "").trim() && !String(w.end ?? "").trim())) {
    return "—";
  }
  const a = String(w.start ?? "").trim() || "—";
  const b = String(w.end ?? "").trim() || "—";
  return `${a} ~ ${b}`;
}

export function formatInstrumentCount(n?: number | null): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${n} 个`;
}
