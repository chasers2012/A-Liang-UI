import { atom } from 'jotai';

import type { RefreshableAsyncRefreshOptions } from '@/lib/refreshable-async-atoms';
import {
  createKnowledgeDocument,
  deleteKnowledgeDocument,
  listKnowledgeDocuments,
  reindexKnowledgeDocument,
  searchKnowledge,
  uploadFile,
} from '@/api/knowledge';
import type { KnowledgeDocumentPublic, KnowledgeSearchHit } from '@/models/knowledge/dto';

type CreateFormItemState = {
  name: string;
  file_name: string;
  file: File;
};

type CreateFormState = {
  files: CreateFormItemState[];
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
  files: [],
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

export const addKnowledgeFilesAtom = atom(null, (get, set, files: File[]) => {
  if (!files.length) return;
  set(knowledgePageAtom, (s) => ({ ...s, error: null }));
  const state = get(knowledgePageAtom);
  const nextFiles = [...state.createForm.files];
  for (const file of files) {
    nextFiles.push({
      name: file.name.replace(/\.[^.]+$/, '') || file.name,
      file_name: file.name,
      file,
    });
  }
  set(knowledgePageAtom, {
    ...state,
    createForm: {
      files: nextFiles,
    },
  });
});

export const removeKnowledgeFileAtom = atom(null, (get, set, index: number) => {
  const state = get(knowledgePageAtom);
  set(knowledgePageAtom, {
    ...state,
    createForm: {
      files: state.createForm.files.filter((_, i) => i !== index),
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

export const refreshKnowledgePageAtom = atom(null, async (_get, set, options?: RefreshableAsyncRefreshOptions) => {
  if (!options?.silent) {
    set(knowledgePageAtom, (s) => ({ ...s, loading: true, error: null }));
  }
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
  const { files } = get(knowledgePageAtom).createForm;
  if (!files.length) {
    set(knowledgePageAtom, (s) => ({ ...s, error: '请先选择文件' }));
    return;
  }
  set(knowledgePageAtom, (s) => ({ ...s, error: null }));
  try {
    for (const item of files) {
      const uploadForm = new FormData();
      uploadForm.append('file', item.file);
      const uploaded = await uploadFile(uploadForm);
      await createKnowledgeDocument({
        name: item.name.trim(),
        uploaded_path: uploaded.path,
      });
    }
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
