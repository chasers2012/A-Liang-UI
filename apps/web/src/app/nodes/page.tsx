"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { Funnel, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  getEvaluationMetric,
  listEvaluationNodeTypes,
  type EvaluationNodeTypeCatalogItemPublic,
} from "@/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CodeJar } from "@/components/ui/code-jar";
import { Page } from "@/components/page";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkflowNodePreviewPanel } from "@/components/workflow-graph/reactflow/node/workflow-step-node-preview";

import { useEffectMicrotask } from "@/hooks/use-effect-microtask";
import {
  evaluationMetricsListAtom,
  refreshEvaluationMetricsListAtom,
} from "@/models/evaluation-metric/list-detail.atom";
import type { EvaluationMetricSummaryPublic } from "@/models/evaluation-metric/dto";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupInput, InputGroupAddon } from "@/components/ui/input-group";
import { Item, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const PREVIEW_SCROLL_CLASS =
  "h-full max-h-[calc(100vh-10rem)] px-6 pb-6 pt-2";

/** 与右侧「预览 / 源码」标签条同一水平与垂直节奏，便于两列对齐 */
const NODE_PAGE_CARD_TOOLBAR =
  "flex w-full shrink-0 flex-row items-center justify-between gap-2 border-b px-4 pb-3 pt-0";

const TAB_TRIGGER_CLASS =
  "inline-flex items-center justify-center rounded-md px-3 py-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[active]:bg-background data-[active]:text-foreground data-[active]:shadow-sm";

function NodesPagePreviewTab(props: {
  catalogLoading: boolean;
  catalogError: string | null;
  selectedRow: EvaluationMetricSummaryPublic | null;
  selectedCatalog: EvaluationNodeTypeCatalogItemPublic | undefined;
}) {
  const { catalogLoading, catalogError, selectedRow, selectedCatalog } = props;

  return (
    <ScrollArea className={cn(PREVIEW_SCROLL_CLASS, "min-h-0 flex-1")}>
      {catalogLoading ? (
        <p className="py-8 text-sm text-muted-foreground">加载节点类型目录…</p>
      ) : catalogError ? (
        <Alert variant="destructive" className="mt-2">
          <AlertTitle>无法加载节点目录</AlertTitle>
          <AlertDescription>{catalogError}</AlertDescription>
        </Alert>
      ) : !selectedRow ? (
        <p className="py-8 text-sm text-muted-foreground">
          请从左侧选择一个节点。
        </p>
      ) : !selectedCatalog ? (
        <div className="space-y-2 py-4">
          <p className="text-sm text-muted-foreground">
            目录中尚未包含「{selectedRow.name}」的类型定义，无法绘制与工作流一致的端口预览。
          </p>
          {selectedRow.workflow_parameters &&
            selectedRow.workflow_parameters.length > 0 ? (
            <WorkflowNodePreviewPanel
              label={selectedRow.name}
              description={selectedRow.description}
              inputs={[]}
              outputs={[]}
              declaredParams={selectedRow.workflow_parameters}
            />
          ) : null}
        </div>
      ) : (
        <WorkflowNodePreviewPanel
          label={selectedCatalog.label}
          description={selectedCatalog.description}
          inputs={selectedCatalog.inputs}
          outputs={selectedCatalog.outputs}
          declaredParams={selectedRow.workflow_parameters ?? null}
          className="pb-2 pt-2"
        />
      )}
    </ScrollArea>
  );
}

type NodeSourceFetchState = {
  id: string | null;
  text: string | null;
  error: string | null;
};

function NodesPageSourceTab(props: {
  selectedRow: EvaluationMetricSummaryPublic | null;
  source: NodeSourceFetchState;
}) {
  const { selectedRow, source } = props;
  const waitingForCurrent =
    Boolean(selectedRow) && source.id !== selectedRow?.id;

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col px-6 pb-6 pt-2">
      {!selectedRow ? (
        <p className="py-8 text-sm text-muted-foreground">
          请从左侧选择一个节点。
        </p>
      ) : waitingForCurrent ? (
        <p className="py-8 text-sm text-muted-foreground">加载源码…</p>
      ) : source.id === selectedRow.id && source.error ? (
        <Alert variant="destructive" className="mt-2 shrink-0">
          <AlertTitle>无法加载源码</AlertTitle>
          <AlertDescription>{source.error}</AlertDescription>
        </Alert>
      ) : (
        <CodeJar
          id={`nodes-list-source-${selectedRow.id}`}
          readOnly
          value={source.text ?? ""}
          className="h-full min-h-0 w-full max-w-full flex-1 sm:min-h-0"
          aria-label="节点 Python 源码"
        />
      )}
    </div>
  );
}

export default function NodesPage() {
  const { items, error } = useAtomValue(evaluationMetricsListAtom);
  const refresh = useSetAtom(refreshEvaluationMetricsListAtom);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<EvaluationNodeTypeCatalogItemPublic[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [sourceFetch, setSourceFetch] = useState<NodeSourceFetchState>({
    id: null,
    text: null,
    error: null,
  });

  useEffectMicrotask(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    let cancelled = false;
    void listEvaluationNodeTypes()
      .then((rows) => {
        if (!cancelled) {
          setCatalog(rows);
          setCatalogError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setCatalogError(e instanceof Error ? e.message : String(e));
        }
      })
      .finally(() => {
        if (!cancelled) setCatalogLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const catalogByType = useMemo(
    () => new Map(catalog.map((c) => [c.type, c])),
    [catalog],
  );

  const effectiveSelectedId = useMemo(() => {
    if (!items?.length) return null;
    if (selectedId != null && items.some((x) => x.id === selectedId)) {
      return selectedId;
    }
    return items[0].id;
  }, [items, selectedId]);

  const selectedRow = useMemo(
    () =>
      items && effectiveSelectedId
        ? (items.find((x) => x.id === effectiveSelectedId) ?? null)
        : null,
    [items, effectiveSelectedId],
  );

  const selectedCatalog = selectedRow
    ? catalogByType.get(selectedRow.id)
    : undefined;

  useEffect(() => {
    if (!selectedRow?.id) {
      return;
    }
    let cancelled = false;
    const id = selectedRow.id;
    void getEvaluationMetric(id)
      .then((d) => {
        if (!cancelled) {
          setSourceFetch({
            id,
            text: d.source,
            error: null,
          });
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setSourceFetch({
            id,
            text: null,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedRow?.id]);

  return (
    <Page
      size="full"
      gap="sm"
      className="flex h-full min-h-0 w-full flex-row overflow-hidden"
    >
      {error && (
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="h-full min-h-0 w-[300px]">
        <CardHeader className="shrink-0">
          <CardTitle>节点列表</CardTitle>

        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
          <div className={NODE_PAGE_CARD_TOOLBAR}>
            <InputGroup className="max-w-xs">
              <InputGroupInput placeholder="搜索" />
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
            </InputGroup>
            <div className="gap-1 flex flex-row justify-end">
              <Button variant="ghost" size="icon"><Funnel /></Button>
              <Button variant="default" size="icon" ><Plus /></Button>
            </div>
          </div>
          <ScrollArea className="min-h-0 w-full flex-1 px-4">
            <div className="flex flex-col gap-1">
              {!items ? (
                <p className="p-6 text-sm text-muted-foreground">加载中…</p>
              ) : items.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">
                  暂无节点。请使用上方「新增节点」开始配置。
                </p>
              ) : (
                items.map((m) => (
                  <Item
                    key={m.id}
                    variant="outline"
                    className={cn(
                      m.id === effectiveSelectedId &&
                      "border-primary bg-muted/50 ring-1 ring-primary/35",
                    )}
                    render={
                      <div
                        role="button"
                        tabIndex={0}
                        className="w-full cursor-pointer text-left outline-none"
                        onClick={() => setSelectedId(m.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedId(m.id);
                          }
                        }}
                      />
                    }
                  >
                    <ItemContent>
                      <ItemTitle>{m.name}</ItemTitle>
                      <ItemDescription>
                        {m.description || "—"}
                      </ItemDescription>
                    </ItemContent>
                  </Item>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
      <Card className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <CardHeader className="shrink-0">
          <CardTitle>节点</CardTitle>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
          <Tabs
            defaultValue="preview"
            className="flex min-h-0 flex-1 flex-col gap-0"
          >
            <div className={NODE_PAGE_CARD_TOOLBAR}>
              <TabsList className="inline-flex h-9 w-fit items-center gap-1 rounded-lg bg-muted/80 p-1 text-muted-foreground">
                <TabsTrigger value="preview" className={TAB_TRIGGER_CLASS}>
                  预览
                </TabsTrigger>
                <TabsTrigger value="source" className={TAB_TRIGGER_CLASS}>
                  源码
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent
              value="preview"
              className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden outline-none data-[hidden]:hidden"
            >
              <NodesPagePreviewTab
                catalogLoading={catalogLoading}
                catalogError={catalogError}
                selectedRow={selectedRow}
                selectedCatalog={selectedCatalog}
              />
            </TabsContent>

            <TabsContent
              value="source"
              className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden outline-none data-[hidden]:hidden"
            >
              <NodesPageSourceTab
                selectedRow={selectedRow}
                source={sourceFetch}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </Page>
  );
}
