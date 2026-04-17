export interface KnowledgeDocumentPublic {
  id: string;
  name: string;
  source_path: string | null;
  status: string;
  error: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeDocumentCreateRequest {
  name: string;
  content: string;
  source_path?: string | null;
  metadata?: Record<string, unknown>;
  auto_index?: boolean;
}

export interface KnowledgeSearchRequest {
  query: string;
  top_k?: number | null;
  threshold?: number | null;
  document_ids?: string[] | null;
}

export interface KnowledgeSearchHit {
  chunk_id: string;
  document_id: string;
  document_name: string;
  content: string;
  score: number;
  metadata: Record<string, unknown>;
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
