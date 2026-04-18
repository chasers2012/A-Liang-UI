import { apiFetchJson } from './client';
import type {
  KnowledgeDocumentCreateRequest,
  KnowledgeDocumentPublic,
  KnowledgeReindexResponse,
  KnowledgeSearchRequest,
  KnowledgeSearchResponse,
  KnowledgeSettings,
} from '@/models/knowledge/dto';

export function listKnowledgeDocuments(): Promise<KnowledgeDocumentPublic[]> {
  return apiFetchJson<KnowledgeDocumentPublic[]>('/knowledge/documents');
}

export function createKnowledgeDocument(body: KnowledgeDocumentCreateRequest): Promise<KnowledgeDocumentPublic> {
  return apiFetchJson<KnowledgeDocumentPublic>('/knowledge/documents', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export type UploadFileResponse = {
  path: string;
  filename: string;
  size: number;
};

export function uploadFile(formData: FormData): Promise<UploadFileResponse> {
  return apiFetchJson<UploadFileResponse>('/uploads/file', {
    method: 'POST',
    body: formData,
  });
}

export function getKnowledgeDocument(documentId: string): Promise<KnowledgeDocumentPublic> {
  return apiFetchJson<KnowledgeDocumentPublic>(`/knowledge/documents/${encodeURIComponent(documentId)}`);
}

export function deleteKnowledgeDocument(documentId: string): Promise<void> {
  return apiFetchJson<void>(`/knowledge/documents/${encodeURIComponent(documentId)}`, {
    method: 'DELETE',
  });
}

export function reindexKnowledgeDocument(documentId: string): Promise<KnowledgeReindexResponse> {
  return apiFetchJson<KnowledgeReindexResponse>(`/knowledge/documents/${encodeURIComponent(documentId)}/reindex`, {
    method: 'POST',
  });
}

export function searchKnowledge(body: KnowledgeSearchRequest): Promise<KnowledgeSearchResponse> {
  return apiFetchJson<KnowledgeSearchResponse>('/knowledge/search', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function getKnowledgeSettings(): Promise<KnowledgeSettings> {
  return apiFetchJson<KnowledgeSettings>('/knowledge/settings');
}

export function putKnowledgeSettings(body: KnowledgeSettings): Promise<KnowledgeSettings> {
  return apiFetchJson<KnowledgeSettings>('/knowledge/settings', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}
