import type {
  EvaluationNodeTypeCatalogItemPublic,
  PreprocessorDetailPublic,
  PreprocessorSummaryPublic,
  WorkflowIOSpecPublic,
} from "@/models";
import { apiFetchJson } from "./client";

export function listPreprocessors(): Promise<PreprocessorSummaryPublic[]> {
  return apiFetchJson<PreprocessorSummaryPublic[]>("/preprocessors");
}

export function listPreprocessorNodeTypes(): Promise<
  EvaluationNodeTypeCatalogItemPublic[]
> {
  return apiFetchJson<EvaluationNodeTypeCatalogItemPublic[]>(
    "/preprocessors/node-types",
  );
}

export function getPreprocessorWorkflowIO(): Promise<WorkflowIOSpecPublic> {
  return apiFetchJson<WorkflowIOSpecPublic>("/preprocessors/workflow-io");
}

export function getPreprocessor(id: string): Promise<PreprocessorDetailPublic> {
  return apiFetchJson<PreprocessorDetailPublic>(
    `/preprocessors/${encodeURIComponent(id)}`,
  );
}

export function getPreprocessorTemplate(): Promise<string> {
  return apiFetchJson<string>("/preprocessors/template");
}

export function createPreprocessor(
  body: unknown,
): Promise<PreprocessorDetailPublic> {
  return apiFetchJson<PreprocessorDetailPublic>("/preprocessors", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function patchPreprocessor(
  id: string,
  body: unknown,
): Promise<PreprocessorDetailPublic> {
  return apiFetchJson<PreprocessorDetailPublic>(
    `/preprocessors/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(body) },
  );
}

export function deletePreprocessor(id: string): Promise<void> {
  return apiFetchJson<void>(`/preprocessors/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
