import type {
  EvaluationMetricDetailPublic,
  EvaluationMetricSummaryPublic,
} from "@/models";
import { apiFetchJson } from "./client";

export function listEvaluationMetrics(): Promise<
  EvaluationMetricSummaryPublic[]
> {
  return apiFetchJson<EvaluationMetricSummaryPublic[]>("/evaluation-metrics");
}

export function getEvaluationMetric(
  id: string,
): Promise<EvaluationMetricDetailPublic> {
  return apiFetchJson<EvaluationMetricDetailPublic>(
    `/evaluation-metrics/${encodeURIComponent(id)}`,
  );
}

export function getEvaluationMetricTemplate(): Promise<string> {
  return apiFetchJson<string>("/evaluation-metrics/template");
}

export function createEvaluationMetric(
  body: unknown,
): Promise<EvaluationMetricDetailPublic> {
  return apiFetchJson<EvaluationMetricDetailPublic>("/evaluation-metrics", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function patchEvaluationMetric(
  id: string,
  body: unknown,
): Promise<EvaluationMetricDetailPublic> {
  return apiFetchJson<EvaluationMetricDetailPublic>(
    `/evaluation-metrics/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(body) },
  );
}

export function deleteEvaluationMetric(id: string): Promise<void> {
  return apiFetchJson<void>(`/evaluation-metrics/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
