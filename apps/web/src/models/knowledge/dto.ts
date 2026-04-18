export interface KnowledgeDocumentPublic {
  id: string;
  name: string;
  status: string;
  error: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeDocumentCreateRequest {
  name: string;
  content?: string | null;
  uploaded_path?: string | null;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeSearchRequest {
  query: string;
}

export interface KnowledgeSearchHit {
  document_name: string;
  content: string;
}

export interface KnowledgeSearchResponse {
  hits: KnowledgeSearchHit[];
}

export interface KnowledgeReindexResponse {
  document_id: string;
  indexed_chunks: number;
  status: string;
}

export interface KnowledgeSettings {
  enabled: boolean;
  top_k: number;
  threshold: number;
  chunk_size: number;
  chunk_overlap: number;
  embedding_dim: number;
  vector_store: string;
  collection_name: string;
}
