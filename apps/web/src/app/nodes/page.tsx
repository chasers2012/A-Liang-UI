"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { Funnel, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { getEvaluationMetric } from "@/api";
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
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

/** 与后端 ``PLUGIN_NODE_SOURCE_SENTINEL`` 一致 */
const PLUGIN_SOURCE_MARKER = "__plugin__";
const UNCATEGORIZED_KEY = "__uncategorized__";

type SourceFilter = "all" | "user" | "plugin";

const PREVIEW_SCROLL_CLASS =
  "h-full max-h-[calc(100vh-10rem)] px-6 pb-6 pt-2";

/** 与右侧「预览 / 源码」标签条同一水平与垂直节奏，便于两列对齐 */
const NODE_PAGE_CARD_TOOLBAR =
  "flex w-full shrink-0 flex-row items-center justify-between gap-2 border-b px-4 pb-3 pt-0";

const TAB_TRIGGER_CLASS =
  "inline-flex items-center justify-center rounded-md px-3 py-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[active]:bg-background data-[active]:text-foreground data-[active]:shadow-sm";

function NodesPagePreviewTab(props: {
  selectedRow: EvaluationMetricSummaryPublic | null;
}) {
  const { selectedRow } = props;

  return (
    <div
      className={cn(
        PREVIEW_SCROLL_CLASS,
        "flex min-h-0 flex-1 flex-col overflow-hidden",
      )}
    >
      {!selectedRow ? (
        <p className="py-8 text-sm text-muted-foreground">
          请从左侧选择一个节点。
        </p>
      ) : (
        <WorkflowNodePreviewPanel
          label={selectedRow.name}
          description={selectedRow.description}
          inputs={selectedRow.inputs}
          outputs={selectedRow.outputs}
          declaredParams={selectedRow.workflow_parameters ?? null}
          className="min-h-0 flex-1 pb-2 pt-2"
        />
      )}
    </div>
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

function categoryKey(m: EvaluationMetricSummaryPublic): string {
  const c = m.category?.trim();
  return c ? c : UNCATEGORIZED_KEY;
}

function categoryLabel(key: string): string {
  return key === UNCATEGORIZED_KEY ? "未分类" : key;
}

export default function NodesPage() {
  const { items, error } = useAtomValue(evaluationMetricsListAtom);
  const refresh = useSetAtom(refreshEvaluationMetricsListAtom);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [includedCategories, setIncludedCategories] = useState<Set<string>>(
    () => new Set(),
  );
  const [sourceFetch, setSourceFetch] = useState<NodeSourceFetchState>({
    id: null,
    text: null,
    error: null,
  });

  useEffectMicrotask(() => {
    void refresh();
  }, [refresh]);

  const categoryOptionKeys = useMemo(() => {
    if (!items?.length) return [];
    const keys = new Set<string>();
    for (const m of items) {
      keys.add(categoryKey(m));
    }
    return [...keys].sort((a, b) =>
      categoryLabel(a).localeCompare(categoryLabel(b), "zh-Hans-CN"),
    );
  }, [items]);

  const filteredItems = useMemo(() => {
    if (!items) return null;
    const q = searchQuery.trim().toLowerCase();
    return items.filter((m) => {
      if (sourceFilter === "user" && m.source_path === PLUGIN_SOURCE_MARKER) {
        return false;
      }
      if (sourceFilter === "plugin" && m.source_path !== PLUGIN_SOURCE_MARKER) {
        return false;
      }
      if (includedCategories.size > 0) {
        const ck = categoryKey(m);
        if (!includedCategories.has(ck)) {
          return false;
        }
      }
      if (q) {
        const hay = `${m.name}\n${m.description}\n${m.type}\n${m.id}`.toLowerCase();
        if (!hay.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [items, searchQuery, sourceFilter, includedCategories]);

  const filterPopoverActive =
    sourceFilter !== "all" || includedCategories.size > 0;

  const toggleCategoryFilter = (key: string) => {
    setIncludedCategories((prev) => {
      const next = new Set(prev);
      if (next.size === 0) {
        return new Set([key]);
      }
      if (next.has(key)) {
        next.delete(key);
        return next;
      }
      next.add(key);
      return next;
    });
  };

  const resetListFilters = () => {
    setSourceFilter("all");
    setIncludedCategories(new Set());
  };

  const effectiveSelectedId = useMemo(() => {
    if (!filteredItems?.length) return null;
    if (selectedId != null && filteredItems.some((x) => x.id === selectedId)) {
      return selectedId;
    }
    return filteredItems[0].id;
  }, [filteredItems, selectedId]);

  const selectedRow = useMemo(
    () =>
      items && effectiveSelectedId
        ? (items.find((x) => x.id === effectiveSelectedId) ?? null)
        : null,
    [items, effectiveSelectedId],
  );

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
              <InputGroupInput
                placeholder="搜索"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="搜索节点"
              />
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
            </InputGroup>
            <div className="flex flex-row justify-end gap-1">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="relative"
                    aria-label="筛选节点"
                  >
                    <Funnel />
                    {filterPopoverActive ? (
                      <span
                        className="absolute right-1 top-1 size-2 rounded-full bg-primary"
                        aria-hidden
                      />
                    ) : null}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="end" sideOffset={8}>
                  <PopoverHeader>
                    <PopoverTitle>筛选</PopoverTitle>
                    <PopoverDescription>
                      按来源与分类缩小列表；分类不勾选表示不限。
                    </PopoverDescription>
                  </PopoverHeader>
                  <div className="mt-3 space-y-4">
                    <div>
                      <div className="mb-2 text-xs font-medium text-muted-foreground">
                        来源
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <Button
                          type="button"
                          variant={sourceFilter === "all" ? "default" : "outline"}
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setSourceFilter("all")}
                        >
                          全部
                        </Button>
                        <Button
                          type="button"
                          variant={sourceFilter === "user" ? "default" : "outline"}
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setSourceFilter("user")}
                        >
                          用户节点
                        </Button>
                        <Button
                          type="button"
                          variant={
                            sourceFilter === "plugin" ? "default" : "outline"
                          }
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setSourceFilter("plugin")}
                        >
                          插件节点
                        </Button>
                      </div>
                    </div>
                    {categoryOptionKeys.length > 0 ? (
                      <div>
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-muted-foreground">
                            分类
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-muted-foreground"
                            onClick={() => setIncludedCategories(new Set())}
                          >
                            清除分类条件
                          </Button>
                        </div>
                        <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
                          {categoryOptionKeys.map((key) => (
                            <label
                              key={key}
                              className="flex cursor-pointer items-center gap-2 text-sm"
                            >
                              <input
                                type="checkbox"
                                className="size-4 shrink-0 rounded border border-input accent-primary"
                                checked={
                                  includedCategories.size === 0
                                    ? false
                                    : includedCategories.has(key)
                                }
                                onChange={() => toggleCategoryFilter(key)}
                              />
                              <span className="truncate">{categoryLabel(key)}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <div className="flex justify-end border-t pt-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8"
                        onClick={resetListFilters}
                      >
                        重置筛选
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              <Button type="button" variant="default" size="icon">
                <Plus />
              </Button>
            </div>
          </div>
          <ScrollArea className="min-h-0 w-full flex-1 px-4">
            <div className="flex flex-col gap-1">
              {!filteredItems ? (
                <p className="p-6 text-sm text-muted-foreground">加载中…</p>
              ) : filteredItems.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">
                  {(items?.length ?? 0) === 0
                    ? "暂无节点。请使用上方「新增节点」开始配置。"
                    : "没有符合当前筛选条件的节点。"}
                </p>
              ) : (
                filteredItems.map((m) => (
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
              <NodesPagePreviewTab selectedRow={selectedRow} />
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
