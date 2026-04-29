import { apiFetchJson } from './client';
import type {
  KnowledgeDocumentCreateRequest,
  KnowledgeDocumentPublic,
  KnowledgeReindexResponse,
  KnowledgeSearchResponse,
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

export function searchKnowledge(query: string): Promise<KnowledgeSearchResponse> {
  return apiFetchJson<KnowledgeSearchResponse>(`/knowledge/search?query=${encodeURIComponent(query)}`);
}
