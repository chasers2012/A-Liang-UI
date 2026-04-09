"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Minus, Plus } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Page } from "@/components/page";
import { PageFormHeaderActions } from "@/components/page-form-header-actions";
import { FactorEditPageDescription } from "@/features/factors/ui/factor-edit-page-description";
import { FactorEditPageTitle } from "@/features/factors/ui/factor-edit-page-title";
import { cn } from "@/lib/utils";
import {
  AliasMapEditor,
  depsFromAliasRows,
  mapFromAliasRows,
  type AliasMapRow,
} from "./alias-map-editor";
import {
  ApiError,
  createDataSet,
  getDataSet,
  getDatasourceDependencyFields,
  listDatasources,
  patchDataSet,
  type DataSetPublic,
  type DataSourcePublic,
} from "@/lib/quant-agent-api";

import type { WorkflowGraphCanvasHandle } from "@/components/workflow-graph";
import type { WorkflowGraphPersisted } from "@/components/workflow-graph/reactflow/types";
import { PreprocessingWorkflowEditorBlock } from "./preprocessing-workflow-editor-block";

export type DataSetBindingFormRow = {
  datasource_id: string;
  alias_rows: AliasMapRow[];
  date_column: string;
  asset_column: string;
};

export type DataSetFormState = {
  name: string;
  description: string;
  bindings: DataSetBindingFormRow[];
  preprocessing_workflow: WorkflowGraphPersisted;
  start: string;
  end: string;
  instrument_codes_text: string;
};

export function emptyDataSetForm(): DataSetFormState {
  const COLLECT_FRAMES_TYPE =
    "factor.preprocessing_workflow_nodes.CollectFrames";
  const INPUT_FRAMES_TYPE =
    "factor.preprocessing_workflow_nodes.DataSetFramesInput";
  const defaultWorkflow: WorkflowGraphPersisted = {
    nodes: [
      {
        id: "frames_input",
        type: INPUT_FRAMES_TYPE,
        label: "原始 frames 输入",
        category: "data_set_preprocess",
        inputs: [],
        outputs: [],
        pos: [0, 0],
        params: {},
      },
      {
        id: "collect_frames",
        type: COLLECT_FRAMES_TYPE,
        label: "预处理结果收集",
        category: "data_set_preprocess",
        inputs: [
          {
            name: "frames",
            required: true,
            value_type: "raw_frames",
            render_type: "appendable",
            label: "输入 frames",
          },
        ],
        outputs: [],
        pos: [360, 0],
        params: {},
      },
    ],
    links: [],
  };
  return {
    name: "",
    description: "",
    bindings: [
      {
        datasource_id: "",
        alias_rows: [{ factor: "", column: "", enabled: true }],
        date_column: "",
        asset_column: "",
      },
    ],
    preprocessing_workflow: defaultWorkflow,
    start: "2023-01-01",
    end: "2024-12-31",
    instrument_codes_text: "",
  };
}

function buildFramesInputOutputs(
  datasourceIds: string[],
  datasourceNameById: Record<string, string>,
): {
  name: string;
  required: boolean;
  value_type: string;
  label: string;
  description: string;
}[] {
  const RAW_FRAMES_VALUE_TYPE = "raw_frames";
  const out = [];
  for (const dsId of datasourceIds) {
    const displayName = datasourceNameById[dsId]?.trim() || dsId;
    out.push({
      name: dsId,
      required: false,
      value_type: RAW_FRAMES_VALUE_TYPE,
      label: displayName,
      description: `仅包含数据源 ${displayName} 的原始 frames 映射。`,
    });
  }
  return out;
}

function syncFramesInputNodeOutputs(
  workflow: WorkflowGraphPersisted,
  datasourceIds: string[],
  datasourceNameById: Record<string, string>,
): WorkflowGraphPersisted {
  const INPUT_FRAMES_TYPE =
    "factor.preprocessing_workflow_nodes.DataSetFramesInput";
  const COLLECT_FRAMES_TYPE =
    "factor.preprocessing_workflow_nodes.CollectFrames";
  const desiredOutputs = buildFramesInputOutputs(datasourceIds, datasourceNameById);
  const desiredSocketNames = new Set(desiredOutputs.map((x) => x.name));
  const currentFramesInputNode = workflow.nodes.find(
    (n) => n.type === INPUT_FRAMES_TYPE,
  );
  const framesInputNodeId = currentFramesInputNode?.id;
  if (!framesInputNodeId) return workflow;
  let hasChange = false;
  const nodes = workflow.nodes.map((node) => {
    if (node.type !== INPUT_FRAMES_TYPE) return node;
    const current = JSON.stringify(node.outputs ?? []);
    const next = JSON.stringify(desiredOutputs);
    if (current === next) return node;
    hasChange = true;
    return { ...node, outputs: desiredOutputs };
  });

  const validLinks = workflow.links.map((link) => {
    if (link.from_node !== framesInputNodeId) return link;
    if (desiredSocketNames.has(link.from_socket)) return link;
    return null;
  }).filter((x): x is WorkflowGraphPersisted["links"][number] => {
    const keep = x !== null;
    if (!keep) hasChange = true;
    return keep;
  });
  let links = validLinks;

  const collectNode = [...nodes]
    .reverse()
    .find((n) => n.type === COLLECT_FRAMES_TYPE);
  if (collectNode && datasourceIds.length > 0) {
    const existingDirectLinkSockets = new Set(
      links
        .filter(
          (l) =>
            l.from_node === framesInputNodeId &&
            l.to_node === collectNode.id &&
            l.to_socket === "frames",
        )
        .map((l) => l.from_socket),
    );
    const defaultLinks = datasourceIds
      .filter((dsId) => !existingDirectLinkSockets.has(dsId))
      .map((dsId) => ({
        from_node: framesInputNodeId,
        from_socket: dsId,
        to_node: collectNode.id,
        to_socket: "frames",
        id: null,
      }));
    if (defaultLinks.length > 0) {
      hasChange = true;
      links = [...links, ...defaultLinks];
    }
  }

  // CollectFrames uses appendable input; ReactFlow restores those edges from
  // node.params.frames (not from links), so keep params in sync with links.
  const nodesWithCollectParams = nodes.map((node) => {
    if (!collectNode || node.id !== collectNode.id) return node;
    const framesWires = links
      .filter((l) => l.to_node === collectNode.id && l.to_socket === "frames")
      .map((l) => ({
        from_node: l.from_node,
        from_socket: l.from_socket,
      }));
    const nodeParams = node.params ?? {};
    const prevFramesWires = Array.isArray(nodeParams["frames"])
      ? nodeParams["frames"]
      : [];
    if (JSON.stringify(prevFramesWires) === JSON.stringify(framesWires)) {
      return node;
    }
    hasChange = true;
    return {
      ...node,
      params: {
        ...nodeParams,
        frames: framesWires,
      },
    };
  });

  if (!hasChange) return workflow;
  return { ...workflow, nodes: nodesWithCollectParams, links };
}

function sameWorkflowGraph(
  a: WorkflowGraphPersisted,
  b: WorkflowGraphPersisted,
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function toDateInputValue(s: string): string {
  const t = (s || "").trim();
  if (t.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  return t;
}

export function hydrateDataSetForm(row: DataSetPublic): DataSetFormState {
  const bindings =
    row.datasource_bindings.length > 0
      ? row.datasource_bindings.map((b) => ({
        datasource_id: b.datasource_id,
        date_column: b.date_column ?? "",
        asset_column: b.asset_column ?? "",
        alias_rows: (() => {
          const alias = b.alias ?? {};
          const deps = b.dependencies ?? [];
          const rows: AliasMapRow[] = [];
          const seen = new Set<string>();
          for (const dep of deps) {
            const logical = String(dep).trim();
            if (!logical || seen.has(logical)) continue;
            seen.add(logical);
            rows.push({
              factor: logical,
              column: alias[logical] ?? logical,
              enabled: true,
            });
          }
          for (const [logicalRaw, physicalRaw] of Object.entries(alias)) {
            const logical = String(logicalRaw).trim();
            const physical = String(physicalRaw).trim();
            if (!logical || !physical || seen.has(logical)) continue;
            seen.add(logical);
            rows.push({ factor: logical, column: physical, enabled: true });
          }
          return rows.length ? rows : [{ factor: "", column: "", enabled: true }];
        })(),
      }))
      : [
        {
          datasource_id: "",
          alias_rows: [{ factor: "", column: "", enabled: true }],
          date_column: "",
          asset_column: "",
        },
      ];
  return {
    name: row.name,
    description: row.description,
    bindings,
    preprocessing_workflow: row.preprocessing_workflow,
    start: toDateInputValue(row.start),
    end: toDateInputValue(row.end),
    instrument_codes_text: row.instrument_codes.length
      ? row.instrument_codes.join("\n")
      : "",
  };
}

export function parseInstrumentCodesFromText(text: string): string[] {
  const parts = text.split(/[\s,;，；]+/u);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of parts) {
    const c = p.trim();
    if (!c || seen.has(c)) continue;
    seen.add(c);
    out.push(c);
  }
  return out;
}

function safeParseJsonObject(text: string): Record<string, unknown> {
  const raw = text.trim();
  if (!raw) return {};
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("config 必须是 JSON object（形如 { ... }）");
  }
  return parsed as Record<string, unknown>;
}

function validateDataSetBindings(bindings: DataSetBindingFormRow[]): string | null {
  if (!bindings.length) return "至少保留一条数据源绑定";
  for (const b of bindings) {
    if (!b.datasource_id.trim()) return "每条绑定须选择数据源";
    if (!b.date_column.trim() || !b.asset_column.trim()) {
      return "每条绑定须选择 date 列与 asset 列";
    }
  }
  if (bindings.length > 1) {
    for (const b of bindings) {
      if (depsFromAliasRows(b.alias_rows).length === 0) {
        return "多个数据源时，每条绑定须至少勾选一个依赖字段";
      }
    }
  }
  return null;
}

function validatePreprocessingWorkflow(
  workflow: WorkflowGraphPersisted,
): string | null {
  const COLLECT_FRAMES_TYPE =
    "factor.preprocessing_workflow_nodes.CollectFrames";

  if (!workflow?.nodes?.length) {
    return "请配置预处理工作流（需要至少包含 CollectFrames 节点）";
  }

  const hasCollect = workflow.nodes.some((n) => n.type === COLLECT_FRAMES_TYPE);
  if (!hasCollect) {
    return "预处理工作流缺少结果收集节点 CollectFrames";
  }

  for (const node of workflow.nodes) {
    const params = node.params ?? {};
    const cfg = params["config_json"];
    if (typeof cfg === "string" && cfg.trim()) {
      try {
        safeParseJsonObject(cfg);
      } catch (e) {
        return e instanceof Error ? e.message : String(e);
      }
    }
  }

  return null;
}

const DATA_SET_MAIN_FORM_ID = "data-set-main-form";

type BindingDependencyMessagesProps = {
  loading: boolean;
  noDataColumns: boolean;
  extras: string[];
};

function BindingDependencyMessages({
  loading,
  noDataColumns,
  extras,
}: BindingDependencyMessagesProps) {
  return (
    <>
      {loading ? (
        <p className="text-xs text-muted-foreground">
          正在加载该数据源可用字段…
        </p>
      ) : null}
      {noDataColumns ? (
        <p className="text-xs text-amber-600 dark:text-amber-500">
          未能读取到该数据源可用字段列表。请检查数据源配置与可连接性/可读性。
        </p>
      ) : null}
      {extras.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          已保存且不在当前列表中的依赖：{" "}
          <span className="font-mono">{extras.join(", ")}</span>
          （仍会提交；若需调整请修改数据源或取消勾选后保存）
        </p>
      ) : null}
    </>
  );
}

type DataSetBindingRowBlockProps = {
  index: number;
  row: DataSetBindingFormRow;
  bindingsLength: number;
  datasources: DataSourcePublic[];
  dependencyFieldsByDsId: Record<string, string[]>;
  dsItems: Record<string, string>;
  bindingDatasources: DataSourcePublic[];
  updateBinding: (i: number, patch: Partial<DataSetBindingFormRow>) => void;
  removeBinding: (i: number) => void;
};

function DataSetBindingRowBlock({
  index,
  row,
  bindingsLength,
  datasources,
  dependencyFieldsByDsId,
  dsItems,
  bindingDatasources,
  updateBinding,
  removeBinding,
}: DataSetBindingRowBlockProps) {
  const ds = datasources.find((d) => d.id === row.datasource_id.trim());
  const trimmedId = row.datasource_id.trim();
  const loading =
    !!ds &&
    !!trimmedId &&
    !Object.prototype.hasOwnProperty.call(dependencyFieldsByDsId, trimmedId);
  const physicalColumns = dependencyFieldsByDsId[trimmedId] ?? [];
  const columnOptions = (() => {
    const set = new Set<string>();
    for (const c of physicalColumns) {
      const t = String(c).trim();
      if (t) set.add(t);
    }
    const d = row.date_column.trim();
    const a = row.asset_column.trim();
    if (d) set.add(d);
    if (a) set.add(a);
    return [...set].sort((x, y) => x.localeCompare(y));
  })();
  const useColumnSelects = columnOptions.length > 0;
  const deps = depsFromAliasRows(row.alias_rows);
  const extras = deps.filter((d) => !physicalColumns.includes(d));
  const noDataColumns = !loading && Boolean(trimmedId) && physicalColumns.length === 0;

  return (
    <div
      className="space-y-3 rounded-lg border border-border/60 bg-muted/5 p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          绑定 {index + 1}
        </span>
        {bindingsLength > 1 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1 text-destructive"
            onClick={() => removeBinding(index)}
          >
            <Minus className="size-4" />
            移除
          </Button>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label>数据源</Label>
        <Select
          modal={false}
          items={dsItems}
          value={row.datasource_id}
          onValueChange={(v) =>
            v &&
            updateBinding(index, {
              datasource_id: v,
              date_column: "",
              asset_column: "",
            })}
          disabled={bindingDatasources.length === 0}
        >
          <SelectTrigger className="w-full min-w-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {bindingDatasources.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name} ({d.type})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>索引列（date / asset）</Label>
        <p className="text-xs text-muted-foreground">
          这两列用于把数据标准化为 (date, asset) 面板索引；与依赖字段映射独立。
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">date_column</Label>
            {useColumnSelects ? (
              <Select
                modal={false}
                value={row.date_column.trim() || undefined}
                onValueChange={(v) => v && updateBinding(index, { date_column: v })}
              >
                <SelectTrigger className="w-full font-mono text-xs">
                  <SelectValue placeholder="选择列" />
                </SelectTrigger>
                <SelectContent>
                  {columnOptions.map((c) => (
                    <SelectItem key={`d-${c}`} value={c} className="font-mono text-xs">
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={row.date_column}
                onChange={(e) => updateBinding(index, { date_column: e.target.value })}
                placeholder="先选择数据源并等待列名加载"
                className="font-mono text-xs"
              />
            )}
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">asset_column</Label>
            {useColumnSelects ? (
              <Select
                modal={false}
                value={row.asset_column.trim() || undefined}
                onValueChange={(v) => v && updateBinding(index, { asset_column: v })}
              >
                <SelectTrigger className="w-full font-mono text-xs">
                  <SelectValue placeholder="选择列" />
                </SelectTrigger>
                <SelectContent>
                  {columnOptions.map((c) => (
                    <SelectItem key={`a-${c}`} value={c} className="font-mono text-xs">
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={row.asset_column}
                onChange={(e) => updateBinding(index, { asset_column: e.target.value })}
                placeholder="先选择数据源并等待列名加载"
                className="font-mono text-xs"
              />
            )}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="space-y-2">
          <Label>依赖字段与映射</Label>
          <p className="text-xs text-muted-foreground">
            在数据集里配置逻辑字段名（因子 dependencies）到数据源真实列名的映射。单数据源时可一个都不启用，表示运行时使用因子全部 dependencies；
            多数据源时须至少启用一项来区分字段归属。
          </p>
          <BindingDependencyMessages
            loading={loading}
            noDataColumns={noDataColumns}
            extras={extras}
          />
          <AliasMapEditor
            physicalColumns={physicalColumns}
            rows={row.alias_rows}
            onChangeRows={(rows) => updateBinding(index, { alias_rows: rows })}
            onAddRow={() =>
              updateBinding(index, {
                alias_rows: [
                  ...(row.alias_rows.length
                    ? row.alias_rows
                    : [{ factor: "", column: "", enabled: true }]),
                  { factor: "", column: "", enabled: true },
                ],
              })}
            onRemoveRow={(removeIndex) =>
              updateBinding(index, {
                alias_rows: row.alias_rows.filter((_, i) => i !== removeIndex),
              })}
          />
        </div>
      </div>
    </div>
  );
}

type Props = {
  mode: "create" | "edit";
  dataSetId?: string;
};

export function DataSetForm({ mode, dataSetId }: Props) {
  const router = useRouter();
  const [datasources, setDatasources] = useState<DataSourcePublic[]>([]);
  const [form, setForm] = useState<DataSetFormState>(emptyDataSetForm);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(mode === "edit");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [canvasKey, setCanvasKey] = useState(0);
  const canvasRef = useRef<WorkflowGraphCanvasHandle | null>(null);
  /** 数据源可用字段（用于勾选），按数据源 id 缓存 */
  const [dependencyFieldsByDsId, setDependencyFieldsByDsId] = useState<
    Record<string, string[]>
  >({});
  const depFieldsLoadedRef = useRef(new Set<string>());

  const set = useCallback((patch: Partial<DataSetFormState>) => {
    setForm((f) => ({ ...f, ...patch }));
  }, []);

  const updateBinding = useCallback(
    (index: number, patch: Partial<DataSetBindingFormRow>) => {
      setForm((f) => ({
        ...f,
        bindings: f.bindings.map((row, i) =>
          i === index ? { ...row, ...patch } : row,
        ),
      }));
    },
    [],
  );

  const addBinding = useCallback(() => {
    setForm((f) => ({
      ...f,
      bindings: [
        ...f.bindings,
        {
          datasource_id: "",
          alias_rows: [{ factor: "", column: "", enabled: true }],
          date_column: "",
          asset_column: "",
        },
      ],
    }));
  }, []);

  const removeBinding = useCallback((index: number) => {
    setForm((f) => ({
      ...f,
      bindings:
        f.bindings.length <= 1 ? f.bindings : f.bindings.filter((_, i) => i !== index),
    }));
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoadError(null);
      try {
        const ds = await listDatasources();
        if (cancelled) return;
        setDatasources(ds);
        if (mode === "edit" && dataSetId) {
          const row = await getDataSet(dataSetId);
          if (cancelled) return;
          setForm(hydrateDataSetForm(row));
          setCanvasKey((k) => k + 1);
        } else if (mode === "create") {
          if (ds.length === 1) {
            setForm((prev) => ({
              ...prev,
              bindings: [
                {
                  datasource_id: ds[0].id,
                  alias_rows: [{ factor: "", column: "", enabled: true }],
                  date_column: "",
                  asset_column: "",
                },
              ],
            }));
          }
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [mode, dataSetId]);

  useEffect(() => {
    const ids = [
      ...new Set(
        form.bindings
          .map((b) => b.datasource_id.trim())
          .filter(Boolean),
      ),
    ];
    for (const id of ids) {
      const ds = datasources.find((d) => d.id === id);
      if (!ds) continue;
      if (depFieldsLoadedRef.current.has(id)) continue;
      depFieldsLoadedRef.current.add(id);
      void getDatasourceDependencyFields(id).then(
        (r) =>
          setDependencyFieldsByDsId((prev) => ({
            ...prev,
            [id]: r.fields,
          })),
        () => {
          setDependencyFieldsByDsId((prev) => ({ ...prev, [id]: [] }));
        },
      );
    }
  }, [form.bindings, datasources]);

  useEffect(() => {
    const datasourceIds = [
      ...new Set(form.bindings.map((b) => b.datasource_id.trim()).filter(Boolean)),
    ];
    const datasourceNameById = Object.fromEntries(
      datasources.map((d) => [d.id, d.name]),
    );
    setForm((prev) => {
      // Always sync against the latest canvas graph first so dataset edits won't
      // override graph edits made directly on the canvas.
      const liveGraph = canvasRef.current?.getGraph();
      const baseWorkflow = liveGraph ?? prev.preprocessing_workflow;
      const syncedWorkflow = syncFramesInputNodeOutputs(
        baseWorkflow,
        datasourceIds,
        datasourceNameById,
      );
      if (
        sameWorkflowGraph(prev.preprocessing_workflow, syncedWorkflow) &&
        !liveGraph
      ) {
        return prev;
      }
      return {
        ...prev,
        preprocessing_workflow: syncedWorkflow,
      };
    });
  }, [form.bindings, datasources]);

  const bindingDatasources = datasources;
  const dsItems: Record<string, string> = {};
  for (const d of bindingDatasources) {
    dsItems[d.id] = `${d.name} (${d.type})`;
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const name = form.name.trim();
    if (!name) {
      setFormError("名称不能为空");
      return;
    }
    const bindingsError = validateDataSetBindings(form.bindings);
    if (bindingsError) {
      setFormError(bindingsError);
      return;
    }
    const wf =
      canvasRef.current?.getGraph() ?? form.preprocessing_workflow;
    const wfError = validatePreprocessingWorkflow(wf);
    if (wfError) {
      setFormError(wfError);
      return;
    }
    const instrument_codes = parseInstrumentCodesFromText(form.instrument_codes_text);
    const datasource_bindings = form.bindings.map((b) => {
      const alias = mapFromAliasRows(b.alias_rows);
      const dependencies = depsFromAliasRows(b.alias_rows);
      return {
        datasource_id: b.datasource_id.trim(),
        dependencies,
        date_column: b.date_column.trim(),
        asset_column: b.asset_column.trim(),
        ...(Object.keys(alias).length ? { alias } : {}),
      };
    });
    const payload = {
      name,
      description: form.description.trim(),
      datasource_bindings,
      preprocessing_workflow: wf,
      start: form.start.trim(),
      end: form.end.trim(),
      instrument_codes,
    };
    setSubmitting(true);
    try {
      if (mode === "create") {
        const created = await createDataSet(payload);
        router.push(`/data/data-sets/${encodeURIComponent(created.id)}`);
      } else if (dataSetId) {
        await patchDataSet(dataSetId, payload);
        router.push(`/data/data-sets/${encodeURIComponent(dataSetId)}`);
      }
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : String(err);
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Page gap="none">
        <p className="text-sm text-muted-foreground">加载中…</p>
      </Page>
    );
  }

  if (loadError && mode === "edit") {
    return (
      <Page gap="sm">
        <Alert variant="destructive">
          <AlertTitle>无法加载数据集</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
        <Link href="/data/data-sets" className={cn(buttonVariants({ variant: "outline" }))}>
          返回列表
        </Link>
      </Page>
    );
  }

  return (
    <Page
      gap="none"
      title={
        <FactorEditPageTitle
          name={form.name}
          onNameChange={(n) => set({ name: n })}
          nameAriaLabel="数据集名称"
        />
      }
      description={
        <FactorEditPageDescription
          description={form.description}
          onDescriptionChange={(d) => set({ description: d })}
          descriptionAriaLabel="数据集说明"
        />
      }
      headerClassName="mb-8"
      action={
        <PageFormHeaderActions
          formId={DATA_SET_MAIN_FORM_ID}
          submitting={submitting}
          submitDisabled={bindingDatasources.length === 0 || !form.name.trim()}
          cancelHref={
            mode === "edit" && dataSetId
              ? `/data/data-sets/${encodeURIComponent(dataSetId)}`
              : "/data/data-sets"
          }
        />
      }
    >
      <form
        id={DATA_SET_MAIN_FORM_ID}
        onSubmit={(e) => void onSubmit(e)}
        className="space-y-8"
      >
        {bindingDatasources.length === 0 ? (
          <Alert variant="destructive">
            <AlertTitle>无可用数据源</AlertTitle>
            <AlertDescription>
              请先在「数据源」中新建至少一个数据源。
            </AlertDescription>
          </Alert>
        ) : null}

        {formError ? (
          <Alert variant="destructive">
            <AlertTitle>提交失败</AlertTitle>
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        ) : null}

        <p className="text-sm text-muted-foreground">
          可配置多条数据源绑定；仅一条且未选依赖字段时，运行评价将使用因子的全部 dependencies。
        </p>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <CardTitle>数据源绑定</CardTitle>
                <CardDescription>
                  每条绑定对应一个数据源及其提供的因子依赖列；多源时须为每条绑定勾选或填写依赖。
                </CardDescription>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addBinding}>
                <Plus className="size-4" />
                添加数据源
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {form.bindings.map((row, index) => (
              <DataSetBindingRowBlock
                key={index}
                index={index}
                row={row}
                bindingsLength={form.bindings.length}
                datasources={datasources}
                dependencyFieldsByDsId={dependencyFieldsByDsId}
                dsItems={dsItems}
                bindingDatasources={bindingDatasources}
                updateBinding={updateBinding}
                removeBinding={removeBinding}
              />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <CardTitle>预处理工作流</CardTitle>
                <CardDescription>
                  把每个预处理器作为工作流节点，通过连线串联并输出最终 frames。
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="min-h-[420px] h-[520px]">
              <PreprocessingWorkflowEditorBlock
                workflow={form.preprocessing_workflow}
                canvasKey={canvasKey}
                canvasRef={canvasRef}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>评价区间与参数</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ts-start">开始日期</Label>
                <DatePicker
                  id="ts-start"
                  value={form.start}
                  onChange={(v) => set({ start: v })}
                  placeholder="选择开始日期"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ts-end">结束日期</Label>
                <DatePicker
                  id="ts-end"
                  value={form.end}
                  onChange={(v) => set({ end: v })}
                  placeholder="选择结束日期"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ts-instruments">标的代码（可选）</Label>
              <Textarea
                id="ts-instruments"
                value={form.instrument_codes_text}
                onChange={(e) => set({ instrument_codes_text: e.target.value })}
                placeholder="每行一个或逗号分隔；留空表示不限制标的范围"
                rows={4}
                className="min-h-0 resize-y font-mono text-xs"
              />
            </div>
          </CardContent>
        </Card>

      </form>
    </Page>
  );
}
