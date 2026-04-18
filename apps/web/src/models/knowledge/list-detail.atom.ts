import { atom } from 'jotai';

import {
  createKnowledgeDocument,
  deleteKnowledgeDocument,
  getKnowledgeSettings,
  listKnowledgeDocuments,
  putKnowledgeSettings,
  reindexKnowledgeDocument,
  searchKnowledge,
  uploadFile,
} from '@/api/knowledge';
import type { KnowledgeDocumentPublic, KnowledgeSearchHit, KnowledgeSettings } from '@/models/knowledge/dto';

type CreateFormState = {
  name: string;
  source_path: string;
  auto_index: boolean;
  file_name: string;
  file: File | null;
};

type SearchFormState = {
  query: string;
};

export type KnowledgePageState = {
  documents: KnowledgeDocumentPublic[];
  hits: KnowledgeSearchHit[];
  settings: KnowledgeSettings | null;
  loading: boolean;
  error: string | null;
  busyDocumentId: string | null;
  createForm: CreateFormState;
  searchForm: SearchFormState;
};

const defaultCreateForm: CreateFormState = {
  name: '',
  source_path: '',
  auto_index: true,
  file_name: '',
  file: null,
};

export const knowledgePageAtom = atom<KnowledgePageState>({
  documents: [],
  hits: [],
  settings: null,
  loading: false,
  error: null,
  busyDocumentId: null,
  createForm: defaultCreateForm,
  searchForm: { query: '' },
});

export const setKnowledgeCreateFieldAtom = atom(
  null,
  (get, set, payload: { key: keyof CreateFormState; value: string | boolean }) => {
    const state = get(knowledgePageAtom);
    set(knowledgePageAtom, {
      ...state,
      createForm: {
        ...state.createForm,
        [payload.key]: payload.value,
      },
    });
  },
);

export const setKnowledgeFileAtom = atom(null, async (get, set, file: File) => {
  set(knowledgePageAtom, (s) => ({ ...s, error: null }));
  const state = get(knowledgePageAtom);
  set(knowledgePageAtom, {
    ...state,
    createForm: {
      ...state.createForm,
      name: file.name.replace(/\.[^.]+$/, '') || file.name,
      source_path: state.createForm.source_path || file.name,
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

export const setKnowledgeSettingFieldAtom = atom(
  null,
  (get, set, payload: { key: keyof KnowledgeSettings; value: string | number | boolean }) => {
    const state = get(knowledgePageAtom);
    if (!state.settings) return;
    set(knowledgePageAtom, {
      ...state,
      settings: {
        ...state.settings,
        [payload.key]: payload.value,
      },
    });
  },
);

export const refreshKnowledgePageAtom = atom(null, async (_get, set) => {
  set(knowledgePageAtom, (s) => ({ ...s, loading: true, error: null }));
  try {
    const [documents, settings] = await Promise.all([listKnowledgeDocuments(), getKnowledgeSettings()]);
    set(knowledgePageAtom, (s) => ({
      ...s,
      documents,
      settings,
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
      source_path: createForm.source_path.trim() || uploaded.filename,
      auto_index: createForm.auto_index,
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
    const resp = await searchKnowledge({ query });
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

export const saveKnowledgeSettingsAtom = atom(null, async (get, set) => {
  const settings = get(knowledgePageAtom).settings;
  if (!settings) return;
  set(knowledgePageAtom, (s) => ({ ...s, loading: true, error: null }));
  try {
    const saved = await putKnowledgeSettings(settings);
    set(knowledgePageAtom, (s) => ({ ...s, settings: saved, loading: false }));
  } catch (e) {
    set(knowledgePageAtom, (s) => ({
      ...s,
      loading: false,
      error: e instanceof Error ? e.message : String(e),
    }));
  }
});
