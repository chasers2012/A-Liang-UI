import type { DataSetPublic } from '@/models/data-set/dto';
import { apiFetchJson } from './client';

export type DataSetPanelPreviewCsvResponse = {
  csv: string;
};

export function listDataSets(): Promise<DataSetPublic[]> {
  return apiFetchJson<DataSetPublic[]>('/data-sets');
}

export function getDataSet(id: string): Promise<DataSetPublic> {
  return apiFetchJson<DataSetPublic>(`/data-sets/${encodeURIComponent(id)}`);
}

export function getDataSetWorkflowTemplate(): Promise<Record<string, unknown>> {
  return apiFetchJson<Record<string, unknown>>('/data-sets/workflow-template');
}

export function createDataSet(body: unknown): Promise<DataSetPublic> {
  return apiFetchJson<DataSetPublic>('/data-sets', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function patchDataSet(id: string, body: unknown): Promise<DataSetPublic> {
  return apiFetchJson<DataSetPublic>(`/data-sets/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function deleteDataSet(id: string): Promise<void> {
  return apiFetchJson<void>(`/data-sets/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export function previewDataSetPanel(
  id: string,
  opts?: {
    limit?: number;
    sample_bdays?: number;
    window?: number;
  },
): Promise<DataSetPanelPreviewCsvResponse> {
  const limit = opts?.limit ?? 200;
  const sample_bdays = opts?.sample_bdays ?? 5;
  const window = opts?.window ?? 0;

  return apiFetchJson<DataSetPanelPreviewCsvResponse>(
    `/data-sets/${encodeURIComponent(id)}/panel-preview?limit=${encodeURIComponent(
      String(limit),
    )}&sample_bdays=${encodeURIComponent(String(sample_bdays))}&window=${encodeURIComponent(String(window))}`,
  );
}
