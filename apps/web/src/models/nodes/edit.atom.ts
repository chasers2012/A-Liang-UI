import { atom } from 'jotai';

import { nodesSelectedIdAtom } from './selection.atom';
import { nodesDetailAtom, saveNodesDetailAtomFamily } from './detail.atom';
import { defaultNewName } from '@/lib/default-new-name';
import {
  applyNameToWorkflowNodeLabel,
  applyTimestampSuffixToWorkflowNodeClassName,
  nodeTemplateAsyncStateAtom,
} from './template.atom';
import type { NodeTypeSocketPublic } from '@/models/evaluation-profile/dto';
import { nodesListAtoms } from './list-detail.atom';
import { deleteNode } from '@/api/nodes';

export type NodesEditState = {
  editing: boolean;
  editName: string | undefined;
  editDescription: string | undefined;
  sourceDraft: string | undefined;
  saving: boolean;
  saveError: string | null;
};

export const nodesEditingAtom = atom(false);
export const nodesEditNameAtom = atom<string | undefined>(undefined);
export const nodesEditDescriptionAtom = atom<string | undefined>(undefined);
export const nodesSourceDraftAtom = atom<string | undefined>(undefined);
export const nodesSavingAtom = atom(false);
export const nodesSaveErrorAtom = atom<string | null>(null);

export const nodesCreateModeAtom = atom(
  (get) => get(nodesEditActiveAtom) && get(nodesSelectedIdAtom) == null,
  (_get, set, next: boolean) => {
    if (next) {
      set(nodesSelectedIdAtom, null);
      set(nodesEditingAtom, true);
      return;
    }
    set(nodesEditingAtom, false);
  },
);

function parseWorkflowNodeSocketsFromSource(source: string): {
  inputs: NodeTypeSocketPublic[];
  outputs: NodeTypeSocketPublic[];
} {
  const parseSocketBlock = (blockKey: 'input_sockets' | 'output_sockets'): NodeTypeSocketPublic[] => {
    const re = new RegExp(`${blockKey}\\s*=\\s*\\[([\\s\\S]*?)\\]`, 'm');
    const m = re.exec(source);
    if (!m) return [];
    const block = m[1] ?? '';
    const sockets: NodeTypeSocketPublic[] = [];
    const socketRe = /Socket\(\s*"([^"]+)"([\s\S]*?)\)/g;
    let sm: RegExpExecArray | null;
    while ((sm = socketRe.exec(block))) {
      const name = sm[1] ?? '';
      const args = sm[2] ?? '';
      const required = /\brequired\s*=\s*True\b/.test(args);
      const valueType = /\bvalue_type\s*=\s*"([^"]+)"/.exec(args)?.[1] ?? 'any';
      const label = /\blabel\s*=\s*"([^"]*)"/.exec(args)?.[1];
      const description = /\bdescription\s*=\s*"([^"]*)"/.exec(args)?.[1];
      if (!name) continue;
      sockets.push({
        name,
        required,
        value_type: valueType,
        ...(label != null ? { label } : {}),
        ...(description != null ? { description } : {}),
      });
    }
    return sockets;
  };

  return {
    inputs: parseSocketBlock('input_sockets'),
    outputs: parseSocketBlock('output_sockets'),
  };
}

export const nodesIsPluginNodeAtom = atom((get) => get(nodesDetailAtom)?.is_plugin === true);

export const nodesCanEditAtom = atom((get) => {
  const detail = get(nodesDetailAtom);
  const isPlugin = get(nodesIsPluginNodeAtom);
  return !isPlugin && (detail != null || get(nodesEditingAtom));
});

export const nodesCanDeleteAtom = atom((get) => {
  const selectedId = get(nodesSelectedIdAtom);
  const detail = get(nodesDetailAtom);
  return selectedId != null && detail != null;
});

export const nodesEditActiveAtom = atom((get) => get(nodesCanEditAtom) && get(nodesEditingAtom));

// eslint-disable-next-line complexity
export const nodesVisibleDetailAtom = atom((get) => {
  const selectedId = get(nodesSelectedIdAtom);
  const detail = get(nodesDetailAtom);
  const editActive = get(nodesEditActiveAtom);
  const createMode = selectedId == null && editActive;

  const templateState = get(nodeTemplateAsyncStateAtom);
  const createDefaults =
    createMode && detail == null
      ? (() => {
          const now = new Date();
          const name = defaultNewName('新节点', now);
          const template = !templateState.loading ? templateState.value : null;
          const source = template
            ? applyTimestampSuffixToWorkflowNodeClassName(applyNameToWorkflowNodeLabel(template, name.trim()), now)
            : '';
          return { name, source };
        })()
      : null;

  const baseName = detail?.name ?? createDefaults?.name ?? '';
  const baseDescription = detail?.description ?? '';
  const baseSource = detail?.source ?? createDefaults?.source ?? '';

  const editName = get(nodesEditNameAtom);
  const editDescription = get(nodesEditDescriptionAtom);
  const sourceDraft = get(nodesSourceDraftAtom);

  const effectiveName = editActive ? (editName ?? baseName) : baseName;
  const effectiveDescription = editActive ? (editDescription ?? baseDescription) : baseDescription;
  const effectiveSource = editActive ? (sourceDraft ?? baseSource) : baseSource;

  const { inputs, outputs } = parseWorkflowNodeSocketsFromSource(effectiveSource ?? '');
  const nowIso = new Date().toISOString();

  if (detail == null) {
    if (!createMode) return null;
    return {
      id: '__new__',
      name: effectiveName || '新节点',
      description: effectiveDescription || '',
      is_plugin: false,
      created_at: nowIso,
      updated_at: nowIso,
      category: null,
      inputs,
      outputs,
      source: effectiveSource || '',
    };
  }

  return {
    ...detail,
    name: effectiveName || detail.name,
    description: effectiveDescription,
    source: effectiveSource,
    inputs,
    outputs,
  };
});

// --- actions ---

export const nodesDeletingAtom = atom(false);

export const handleSaveNodesDetailAtom = atom(null, async (get, set) => {
  const saving = get(nodesSavingAtom);
  if (saving) return;

  const selectedId = get(nodesSelectedIdAtom);
  const detail = get(nodesDetailAtom);
  const visibleDetail = get(nodesVisibleDetailAtom);
  if (!visibleDetail) return;

  set(nodesSavingAtom, true);
  set(nodesSaveErrorAtom, null);
  const saved = await set(saveNodesDetailAtomFamily(selectedId), {
    editName: visibleDetail.name,
    editDescription: visibleDetail.description,
    sourceDraft: visibleDetail.source,
    existingId: detail?.id ?? null,
  });
  set(nodesSavingAtom, false);

  if (!saved) {
    set(nodesSaveErrorAtom, '保存失败');
    return;
  }

  set(nodesEditingAtom, false);
  set(nodesEditNameAtom, undefined);
  set(nodesEditDescriptionAtom, undefined);
  set(nodesSourceDraftAtom, undefined);
  if (selectedId == null) {
    set(nodesSelectedIdAtom, saved.id);
  }
});

export const handleCancelNodesEditAtom = atom(null, (get, set) => {
  const selectedId = get(nodesSelectedIdAtom);
  const createMode = selectedId == null && get(nodesEditActiveAtom);
  if (createMode) {
    set(nodesEditNameAtom, undefined);
    set(nodesEditDescriptionAtom, undefined);
    set(nodesSourceDraftAtom, undefined);
    set(nodesSaveErrorAtom, null);
    set(nodesEditingAtom, false);
    return;
  }
  set(nodesSaveErrorAtom, null);
  set(nodesEditingAtom, false);
  set(nodesEditNameAtom, undefined);
  set(nodesEditDescriptionAtom, undefined);
  set(nodesSourceDraftAtom, undefined);
});

export const handleDeleteNodeAtom = atom(null, async (get, set) => {
  const deleting = get(nodesDeletingAtom);
  const canDelete = get(nodesCanDeleteAtom);
  const isPlugin = get(nodesIsPluginNodeAtom);
  const detail = get(nodesDetailAtom);
  if (deleting || !canDelete || isPlugin || !detail) return;

  set(nodesDeletingAtom, true);
  try {
    await deleteNode(detail.id);
    await set(nodesListAtoms.refreshAtom);
    set(nodesSelectedIdAtom, null);
  } finally {
    set(nodesDeletingAtom, false);
  }
});
