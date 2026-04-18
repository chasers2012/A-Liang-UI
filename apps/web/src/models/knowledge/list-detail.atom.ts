import { atom } from 'jotai';

import {
  createKnowledgeDocument,
  deleteKnowledgeDocument,
  listKnowledgeDocuments,
  reindexKnowledgeDocument,
  searchKnowledge,
  uploadFile,
} from '@/api/knowledge';
import type { KnowledgeDocumentPublic, KnowledgeSearchHit } from '@/models/knowledge/dto';

type CreateFormState = {
  name: string;
  file_name: string;
  file: File | null;
};

type SearchFormState = {
  query: string;
};

export type KnowledgePageState = {
  documents: KnowledgeDocumentPublic[];
  hits: KnowledgeSearchHit[];
  loading: boolean;
  error: string | null;
  busyDocumentId: string | null;
  createForm: CreateFormState;
  searchForm: SearchFormState;
};

const defaultCreateForm: CreateFormState = {
  name: '',
  file_name: '',
  file: null,
};

export const knowledgePageAtom = atom<KnowledgePageState>({
  documents: [],
  hits: [],
  loading: false,
  error: null,
  busyDocumentId: null,
  createForm: defaultCreateForm,
  searchForm: { query: '' },
});

export const setKnowledgeFileAtom = atom(null, async (get, set, file: File) => {
  set(knowledgePageAtom, (s) => ({ ...s, error: null }));
  const state = get(knowledgePageAtom);
  set(knowledgePageAtom, {
    ...state,
    createForm: {
      ...state.createForm,
      name: file.name.replace(/\.[^.]+$/, '') || file.name,
      file_name: file.name,
      file,
    },
  });
});

export const setKnowledgeSearchQueryAtom = atom(null, (get, set, value: string) => {
  const state = get(knowledgePageAtom);
  set(knowledgePageAtom, {
    ...state,
    searchForm: { query: value },
  });
});

export const refreshKnowledgePageAtom = atom(null, async (_get, set) => {
  set(knowledgePageAtom, (s) => ({ ...s, loading: true, error: null }));
  try {
    const documents = await listKnowledgeDocuments();
    set(knowledgePageAtom, (s) => ({
      ...s,
      documents,
      loading: false,
      error: null,
    }));
  } catch (e) {
    set(knowledgePageAtom, (s) => ({
      ...s,
      loading: false,
      error: e instanceof Error ? e.message : String(e),
    }));
  }
});

export const createKnowledgeDocumentAtom = atom(null, async (get, set) => {
  const { createForm } = get(knowledgePageAtom);
  if (!createForm.file) {
    set(knowledgePageAtom, (s) => ({ ...s, error: '请先选择文件' }));
    return;
  }
  set(knowledgePageAtom, (s) => ({ ...s, error: null }));
  try {
    const uploadForm = new FormData();
    uploadForm.append('file', createForm.file);
    const uploaded = await uploadFile(uploadForm);
    await createKnowledgeDocument({
      name: createForm.name.trim(),
      uploaded_path: uploaded.path,
    });
    set(knowledgePageAtom, (s) => ({ ...s, createForm: defaultCreateForm }));
    await set(refreshKnowledgePageAtom);
  } catch (e) {
    set(knowledgePageAtom, (s) => ({ ...s, error: e instanceof Error ? e.message : String(e) }));
  }
});

export const deleteKnowledgeDocumentAtom = atom(null, async (_get, set, documentId: string) => {
  set(knowledgePageAtom, (s) => ({ ...s, busyDocumentId: documentId, error: null }));
  try {
    await deleteKnowledgeDocument(documentId);
    await set(refreshKnowledgePageAtom);
  } catch (e) {
    set(knowledgePageAtom, (s) => ({ ...s, error: e instanceof Error ? e.message : String(e) }));
  } finally {
    set(knowledgePageAtom, (s) => ({ ...s, busyDocumentId: null }));
  }
});

export const reindexKnowledgeDocumentAtom = atom(null, async (_get, set, documentId: string) => {
  set(knowledgePageAtom, (s) => ({ ...s, busyDocumentId: documentId, error: null }));
  try {
    await reindexKnowledgeDocument(documentId);
    await set(refreshKnowledgePageAtom);
  } catch (e) {
    set(knowledgePageAtom, (s) => ({ ...s, error: e instanceof Error ? e.message : String(e) }));
  } finally {
    set(knowledgePageAtom, (s) => ({ ...s, busyDocumentId: null }));
  }
});

export const searchKnowledgeAtom = atom(null, async (get, set) => {
  const query = get(knowledgePageAtom).searchForm.query.trim();
  if (!query) {
    set(knowledgePageAtom, (s) => ({ ...s, hits: [], error: null }));
    return;
  }
  set(knowledgePageAtom, (s) => ({ ...s, loading: true, error: null }));
  try {
    const resp = await searchKnowledge(query);
    set(knowledgePageAtom, (s) => ({
      ...s,
      hits: resp.hits,
      loading: false,
      error: null,
    }));
  } catch (e) {
    set(knowledgePageAtom, (s) => ({
      ...s,
      loading: false,
      error: e instanceof Error ? e.message : String(e),
    }));
  }
});
