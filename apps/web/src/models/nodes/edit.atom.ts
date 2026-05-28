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
import { findFirst, findNodes, parsePythonCall, withPythonTree, type TSNode } from '@/lib/python-parser';

export type NodesEditState = {
  editing: boolean;
  editName: string | undefined;
  editDescription: string | undefined;
  sourceDraft: string | undefined;
  saving: boolean;
  saveError: string | null;
};

const nodesEditingStateAtom = atom(false);
export const nodesEditingAtom = atom(
  (get) => get(nodesEditingStateAtom),
  (_get, set, next: boolean) => {
    set(nodesEditingStateAtom, next);
  },
);
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

const RENDER_TYPE_BY_CALLEE: Record<string, string> = {
  Socket: 'socket',
  NumberNodeParam: 'number',
  StringNodeParam: 'input',
  NodeParam: 'input',
  TextareaNodeParam: 'textarea',
  BooleanNodeParam: 'toggle',
  OptionsNodeParam: 'select',
  DateNodeParam: 'date',
  DateTimeNodeParam: 'datetime',
  RJSFNodeParam: 'rjsf',
};

const VALUE_TYPE_BY_CALLEE: Record<string, string> = {
  NumberNodeParam: 'number',
  StringNodeParam: 'string',
  TextareaNodeParam: 'string',
  BooleanNodeParam: 'boolean',
  DateNodeParam: 'date',
  DateTimeNodeParam: 'datetime',
};

function buildSocketModel(
  callee: string,
  named: Map<string, unknown>,
  positionalName?: string,
): NodeTypeSocketPublic | null {
  const name = (named.get('name') as string | undefined) ?? positionalName ?? '';
  if (!name) return null;

  const inferredRenderType = RENDER_TYPE_BY_CALLEE[callee] ?? null;
  const renderType = named.get('render_type');

  const model: NodeTypeSocketPublic = (() => {
    const rawValueType = named.get('value_type') as string | undefined;
    const value_type = rawValueType?.trim() ? rawValueType : (VALUE_TYPE_BY_CALLEE[callee] ?? '');
    return {
      name,
      required: Boolean(named.get('required') ?? false),
      value_type,
    };
  })();

  const rawLabel = named.get('label') as string | undefined;
  const label = rawLabel?.trim() ? rawLabel : name;

  // 与后端 Socket.__init__ 对齐：label 为空时回退到 name
  model.label = label;
  model.description = named.get('description') as string | undefined;
  model.type = named.get('type') as string | undefined;
  model.minimum = named.get('minimum') as number | null | undefined;
  model.maximum = named.get('maximum') as number | null | undefined;
  model.options = named.get('options') as Array<string | number> | undefined;

  if (named.has('default')) model.default = named.get('default') as never;

  model.render_type =
    (typeof renderType === 'string' || renderType === null ? (renderType as string | null) : undefined) ??
    inferredRenderType ??
    undefined;

  return model;
}

function parseSocketList(listNode: TSNode | null): NodeTypeSocketPublic[] {
  if (!listNode) return [];

  return listNode.namedChildren
    .filter((child) => child.type === 'call')
    .map((call) => parsePythonCall(call))
    .filter((x): x is NonNullable<typeof x> => x != null)
    .map(({ callee, args }) => ({
      type: callee,
      name: (args.positional[0] as string | undefined) ?? (args.keyword.name as string | undefined),
      keyword: args.keyword,
    }))
    .filter(({ type }) => type === 'Socket' || type.endsWith('NodeParam'))
    .map(({ type, name, keyword }) => buildSocketModel(type, new Map(Object.entries(keyword)), name))
    .filter((x): x is NonNullable<typeof x> => x != null);
}

function getWorkflowNodeCallFromDecorator(decorator: TSNode): TSNode | null {
  const call = findFirst(decorator, 'call');
  if (!call) return null;
  const func = call.childForFieldName('function');
  return func?.text.trim() === 'workflow_node' ? call : null;
}

function getDecoratorNodesFromDecoratedDefinition(def: TSNode): TSNode[] {
  return def.namedChildren.filter((c) => c.type === 'decorator');
}

function extractWorkflowNodeIOListsFromCall(call: TSNode): { inputList: TSNode | null; outputList: TSNode | null } {
  const argsNode = call.childForFieldName('arguments');
  if (!argsNode) return { inputList: null, outputList: null };

  let inputList: TSNode | null = null;
  let outputList: TSNode | null = null;

  for (const child of argsNode.namedChildren) {
    if (child.type !== 'keyword_argument') continue;
    const name = child.childForFieldName('name')?.text.trim();
    const value = child.childForFieldName('value');
    if (!name || !value) continue;
    if (name === 'input_sockets') inputList = value.type === 'list' ? value : null;
    if (name === 'output_sockets') outputList = value.type === 'list' ? value : null;
  }

  return { inputList, outputList };
}

function findWorkflowNodeIOLists(root: TSNode): { inputList: TSNode | null; outputList: TSNode | null } | null {
  for (const def of findNodes(root, 'decorated_definition')) {
    for (const decorator of getDecoratorNodesFromDecoratedDefinition(def)) {
      const call = getWorkflowNodeCallFromDecorator(decorator);
      if (!call) continue;
      return extractWorkflowNodeIOListsFromCall(call);
    }
  }
  return null;
}

function parseWorkflowNodeSocketsFromSource(source: string): {
  inputs: NodeTypeSocketPublic[];
  outputs: NodeTypeSocketPublic[];
} {
  return (
    withPythonTree(source, (root) => {
      const lists = findWorkflowNodeIOLists(root);
      if (!lists) return { inputs: [], outputs: [] };
      return {
        inputs: parseSocketList(lists.inputList),
        outputs: parseSocketList(lists.outputList),
      };
    }) ?? { inputs: [], outputs: [] }
  );
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
  const baseDescription = detail?.description ?? detail?.desc ?? '';
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
      desc: effectiveDescription || '',
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
    description: effectiveDescription || detail.description || detail.desc || '',
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
