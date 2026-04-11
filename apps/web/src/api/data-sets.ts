import type { DataSetPublic } from "@/models";
import { apiFetchJson } from "./client";

export function listDataSets(): Promise<DataSetPublic[]> {
  return apiFetchJson<DataSetPublic[]>("/data-sets");
}

export function getDataSet(id: string): Promise<DataSetPublic> {
  return apiFetchJson<DataSetPublic>(`/data-sets/${encodeURIComponent(id)}`);
}

export function getDataSetWorkflowTemplate(): Promise<Record<string, unknown>> {
  return apiFetchJson<Record<string, unknown>>("/data-sets/workflow-template");
}

export function createDataSet(body: unknown): Promise<DataSetPublic> {
  return apiFetchJson<DataSetPublic>("/data-sets", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function patchDataSet(
  id: string,
  body: unknown,
): Promise<DataSetPublic> {
  return apiFetchJson<DataSetPublic>(`/data-sets/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteDataSet(id: string): Promise<void> {
  return apiFetchJson<void>(`/data-sets/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
