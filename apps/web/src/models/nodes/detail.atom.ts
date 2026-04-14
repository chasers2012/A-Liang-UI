import { atom } from "jotai";
import { atomFamily } from "jotai-family";

import {
  createNode,
  getNode,
  getNodeTemplate,
  patchNode,
} from "@/api";
import { defaultNewName } from "@/lib/default-new-name";
import { refreshNodesListAtom } from "@/models/nodes/list-detail.atom";
import type { NodeDetailPublic } from "@/models/nodes/dto";

export const EMPTY_NODE_DETAIL_KEY = "__none__";
export const NEW_NODE_DETAIL_KEY = "__new__";

function applyNameToWorkflowNodeLabel(src: string, label: string) {
  const escaped = label.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return src.replace(
    /(@workflow_node\([\s\S]*?\blabel=")([^"]*)(")/,
    (_: string, prefix: string, _oldLabel: string, suffix: string) => {
      return `${prefix}${escaped}${suffix}`;
    },
  );
}

function applyTimestampSuffixToWorkflowNodeClassName(src: string, now = new Date()) {
  const toPascalCase = (raw: string) =>
    raw
      .replace(/[^a-zA-Z0-9]+/g, " ")
      .split(" ")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join("");
  const timestamp = [
    now.getFullYear().toString(),
    (now.getMonth() + 1).toString().padStart(2, "0"),
    now.getDate().toString().padStart(2, "0"),
    now.getHours().toString().padStart(2, "0"),
    now.getMinutes().toString().padStart(2, "0"),
    now.getSeconds().toString().padStart(2, "0"),
  ].join("");

  return src.replace(
    /^(\s*class\s+)([A-Za-z_][A-Za-z0-9_]*)(\s*(?:\(|:))/m,
    (_: string, prefix: string, oldName: string, suffix: string) => {
      const normalized = toPascalCase(oldName) || "WorkflowNode";
      return `${prefix}${normalized}${timestamp}${suffix}`;
    },
  );
}

export function getNodesDetailStateKey(nodeId: string | null | undefined) {
  return nodeId || EMPTY_NODE_DETAIL_KEY;
}

export type NodesDetailPanelState = {
  loading: boolean;
  detail: NodeDetailPublic | null;
  loadError: string | null;
  editing: boolean;
  editName: string;
  editDescription: string;
  sourceDraft: string;
  saveError: string | null;
  saving: boolean;
};

function initialNodesDetailPanelState(): NodesDetailPanelState {
  return {
    loading: false,
    detail: null,
    loadError: null,
    editing: false,
    editName: "",
    editDescription: "",
    sourceDraft: "",
    saveError: null,
    saving: false,
  };
}

export const nodesDetailPanelStateAtomFamily = atomFamily((key: string) => {
  void key;
  return atom<NodesDetailPanelState>(initialNodesDetailPanelState());
});

export const loadNodesDetailPanelAtomFamily = atomFamily((key: string) =>
  atom(null, async (_get, set) => {
    if (!key || key === EMPTY_NODE_DETAIL_KEY) {
      set(nodesDetailPanelStateAtomFamily(key), initialNodesDetailPanelState());
      return;
    }
    set(nodesDetailPanelStateAtomFamily(key), (s) => ({
      ...s,
      loading: true,
      loadError: null,
      saveError: null,
      editing: key === NEW_NODE_DETAIL_KEY ? true : false,
    }));
    try {
      if (key === NEW_NODE_DETAIL_KEY) {
        const now = new Date();
        const name = defaultNewName("新节点", now);
        const baseDetail: NodeDetailPublic = {
          id: NEW_NODE_DETAIL_KEY,
          name,
          description: "",
          source: "",
          source_path: "",
          created_at: "",
          updated_at: "",
          type: "",
          category: null,
          entry: "",
          inputs: [],
          outputs: [],
          workflow_parameters: [],
        };
        // 先落一个可编辑的空壳，避免 UI 在模板加载期间处于无 detail 状态
        set(nodesDetailPanelStateAtomFamily(key), {
          loading: true,
          detail: baseDetail,
          loadError: null,
          editing: true,
          editName: name,
          editDescription: "",
          sourceDraft: "",
          saveError: null,
          saving: false,
        });
        const template = await getNodeTemplate();
        const sourceDraft = applyTimestampSuffixToWorkflowNodeClassName(
          applyNameToWorkflowNodeLabel(template, name.trim()),
          now,
        );
        set(nodesDetailPanelStateAtomFamily(key), {
          loading: false,
          detail: { ...baseDetail, source: sourceDraft },
          loadError: null,
          editing: true,
          editName: name,
          editDescription: "",
          sourceDraft,
          saveError: null,
          saving: false,
        });
        return;
      }
      const detail = await getNode(key);
      set(nodesDetailPanelStateAtomFamily(key), {
        loading: false,
        detail,
        loadError: null,
        editing: false,
        editName: detail.name,
        editDescription: detail.description ?? "",
        sourceDraft: detail.source,
        saveError: null,
        saving: false,
      });
    } catch (e) {
      set(nodesDetailPanelStateAtomFamily(key), {
        ...initialNodesDetailPanelState(),
        loading: false,
        loadError: e instanceof Error ? e.message : String(e),
      });
    }
  }),
);

export const startNodesDetailEditAtomFamily = atomFamily((key: string) =>
  atom(null, (get, set) => {
    const state = get(nodesDetailPanelStateAtomFamily(key));
    if (!state.detail) return;
    set(nodesDetailPanelStateAtomFamily(key), (s) => ({
      ...s,
      editing: true,
      saveError: null,
      editName: state.detail?.name ?? s.editName,
      editDescription: state.detail?.description ?? s.editDescription,
      sourceDraft: state.detail?.source ?? s.sourceDraft,
    }));
  }),
);

export const cancelNodesDetailEditAtomFamily = atomFamily((key: string) =>
  atom(null, (get, set) => {
    const state = get(nodesDetailPanelStateAtomFamily(key));
    set(nodesDetailPanelStateAtomFamily(key), (s) => ({
      ...s,
      editing: false,
      saveError: null,
      editName: state.detail?.name ?? "",
      editDescription: state.detail?.description ?? "",
      sourceDraft: state.detail?.source ?? "",
    }));
  }),
);

export const setNodesDetailEditNameAtomFamily = atomFamily((key: string) =>
  atom(null, (get, set, name: string) => {
    const prev = get(nodesDetailPanelStateAtomFamily(key));
    const sourceDraft = name.trim()
      ? applyNameToWorkflowNodeLabel(prev.sourceDraft, name.trim())
      : prev.sourceDraft;
    set(nodesDetailPanelStateAtomFamily(key), (s) => ({
      ...s,
      editName: name,
      sourceDraft,
    }));
  }),
);

export const setNodesDetailEditDescriptionAtomFamily = atomFamily((key: string) =>
  atom(null, (_get, set, description: string) => {
    set(nodesDetailPanelStateAtomFamily(key), (s) => ({
      ...s,
      editDescription: description,
    }));
  }),
);

export const setNodesDetailSourceDraftAtomFamily = atomFamily((key: string) =>
  atom(null, (_get, set, sourceDraft: string) => {
    set(nodesDetailPanelStateAtomFamily(key), (s) => ({
      ...s,
      sourceDraft,
    }));
  }),
);

export const saveNodesDetailAtomFamily = atomFamily((key: string) =>
  atom(null, async (get, set) => {
    const state = get(nodesDetailPanelStateAtomFamily(key));
    if (!state.detail) return null;
    set(nodesDetailPanelStateAtomFamily(key), (s) => ({
      ...s,
      saveError: null,
      saving: true,
    }));
    try {
      const detail =
        key === NEW_NODE_DETAIL_KEY
          ? await createNode({
              name: state.editName.trim(),
              description: state.editDescription.trim(),
              ...(state.sourceDraft.trim()
                ? { source: state.sourceDraft.trim() }
                : {}),
            })
          : await patchNode(state.detail.id, {
              source: state.sourceDraft.trim(),
            });
      await set(refreshNodesListAtom);
      set(nodesDetailPanelStateAtomFamily(key), {
        loading: false,
        detail,
        loadError: null,
        editing: false,
        editName: detail.name,
        editDescription: detail.description ?? "",
        sourceDraft: detail.source,
        saveError: null,
        saving: false,
      });
      return detail;
    } catch (err) {
      set(nodesDetailPanelStateAtomFamily(key), (s) => ({
        ...s,
        saving: false,
        saveError: err instanceof Error ? err.message : String(err),
      }));
      return null;
    }
  }),
);
