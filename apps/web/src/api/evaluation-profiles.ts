import type {
  EvaluationNodeTypeCatalogItemPublic,
  EvaluationProfilePublic,
  FactorEvaluationRowPublic,
  WorkflowIOSpecPublic,
} from "@/models";
import { apiFetchJson } from "./client";

export function runFactorEvaluation(
  factorId: string,
  options: {
    dataSetId?: string | null;
    evaluationProfileId: string;
  },
): Promise<FactorEvaluationRowPublic> {
  const profileId = options.evaluationProfileId.trim();
  if (!profileId) {
    return Promise.reject(new Error("evaluationProfileId is required"));
  }
  const init: RequestInit = { method: "POST" };
  const body: Record<string, string> = {
    profile_id: profileId,
    factor_id: factorId,
  };
  const ds = options.dataSetId?.trim();
  if (ds) {
    body.data_set_id = ds;
  }
  init.body = JSON.stringify(body);
  return apiFetchJson<FactorEvaluationRowPublic>(
    "/evaluation-profiles/evaluations/run",
    init,
  );
}

export function listEvaluationProfiles(): Promise<EvaluationProfilePublic[]> {
  return apiFetchJson<EvaluationProfilePublic[]>("/evaluation-profiles");
}

export function getEvaluationProfile(
  id: string,
): Promise<EvaluationProfilePublic> {
  return apiFetchJson<EvaluationProfilePublic>(
    `/evaluation-profiles/${encodeURIComponent(id)}`,
  );
}

export function createEvaluationProfile(
  body: unknown,
): Promise<EvaluationProfilePublic> {
  return apiFetchJson<EvaluationProfilePublic>("/evaluation-profiles", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function patchEvaluationProfile(
  id: string,
  body: unknown,
): Promise<EvaluationProfilePublic> {
  return apiFetchJson<EvaluationProfilePublic>(
    `/evaluation-profiles/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(body) },
  );
}

export function deleteEvaluationProfile(id: string): Promise<void> {
  return apiFetchJson<void>(`/evaluation-profiles/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function listEvaluationNodeTypes(): Promise<
  EvaluationNodeTypeCatalogItemPublic[]
> {
  return apiFetchJson<EvaluationNodeTypeCatalogItemPublic[]>(
    "/evaluation-profiles/node-types",
  );
}

export function getEvaluationWorkflowIO(): Promise<WorkflowIOSpecPublic> {
  return apiFetchJson<WorkflowIOSpecPublic>("/evaluation-profiles/workflow-io");
}

export function getEvaluationWorkflowTemplate(): Promise<
  Record<string, unknown>
> {
  return apiFetchJson<Record<string, unknown>>(
    "/evaluation-profiles/workflow-template",
  );
}
