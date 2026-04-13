"use client";

import { useEffect, useState } from "react";

import { getEvaluationMetric } from "@/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CodeJar } from "@/components/ui/code-jar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkflowNodePreviewPanel } from "@/components/workflow-graph/reactflow/node/workflow-step-node-preview";
import { cn } from "@/lib/utils";
import type { EvaluationMetricDetailPublic } from "@/models/evaluation-metric/dto";

const PREVIEW_SCROLL_CLASS =
  "h-full max-h-[calc(100vh-10rem)] px-6 pb-6 pt-2";

const NODE_PAGE_CARD_TOOLBAR =
  "flex w-full shrink-0 flex-row items-center justify-between gap-2 border-b px-4 pb-3 pt-0";

const TAB_TRIGGER_CLASS =
  "inline-flex items-center justify-center rounded-md px-3 py-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[active]:bg-background data-[active]:text-foreground data-[active]:shadow-sm";

const EMPTY_HINT = "请从左侧选择一个节点。";

function PanelPreviewTab(props: {
  detail: EvaluationMetricDetailPublic | null;
  placeholder: string;
}) {
  const { detail, placeholder } = props;

  return (
    <div
      className={cn(
        PREVIEW_SCROLL_CLASS,
        "flex min-h-0 flex-1 flex-col overflow-hidden",
      )}
    >
      {!detail ? (
        <p className="py-8 text-sm text-muted-foreground">{placeholder}</p>
      ) : (
        <WorkflowNodePreviewPanel
          label={detail.name}
          description={detail.description}
          inputs={detail.inputs}
          outputs={detail.outputs}
          declaredParams={detail.workflow_parameters ?? null}
          className="min-h-0 flex-1 pb-2 pt-2"
        />
      )}
    </div>
  );
}

function PanelSourceTab(props: {
  detail: EvaluationMetricDetailPublic | null;
  placeholder: string;
}) {
  const { detail, placeholder } = props;

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col px-6 pb-6 pt-2">
      {!detail ? (
        <p className="py-8 text-sm text-muted-foreground">{placeholder}</p>
      ) : (
        <CodeJar
          id={`nodes-detail-source-${detail.id}`}
          readOnly
          value={detail.source}
          className="h-full min-h-0 w-full max-w-full flex-1 sm:min-h-0"
          aria-label="节点 Python 源码"
        />
      )}
    </div>
  );
}

type PanelFetchState =
  | { status: "idle" }
  | { status: "ok"; detail: EvaluationMetricDetailPublic }
  | { status: "error"; forId: string; message: string };

export function NodesNodeDetailPanel(props: { metricId: string | null }) {
  const { metricId } = props;
  const [fetchState, setFetchState] = useState<PanelFetchState>({
    status: "idle",
  });

  useEffect(() => {
    if (!metricId) return;
    let cancelled = false;
    void getEvaluationMetric(metricId)
      .then((d) => {
        if (!cancelled) setFetchState({ status: "ok", detail: d });
      })
      .catch((e) => {
        if (!cancelled) {
          setFetchState({
            status: "error",
            forId: metricId,
            message: e instanceof Error ? e.message : String(e),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [metricId]);

  if (
    metricId &&
    fetchState.status === "error" &&
    fetchState.forId === metricId
  ) {
    return (
      <>
        <CardHeader className="shrink-0">
          <CardTitle>节点</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <Alert variant="destructive">
            <AlertTitle>加载失败</AlertTitle>
            <AlertDescription>{fetchState.message}</AlertDescription>
          </Alert>
        </CardContent>
      </>
    );
  }

  const detail =
    fetchState.status === "ok" && fetchState.detail.id === metricId
      ? fetchState.detail
      : null;

  const placeholder = !metricId ? EMPTY_HINT : "加载中…";

  return (
    <>
      <CardHeader className="shrink-0">
        <CardTitle>节点</CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
        <Tabs
          key={metricId ?? "none"}
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
            <PanelPreviewTab detail={detail} placeholder={placeholder} />
          </TabsContent>

          <TabsContent
            value="source"
            className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden outline-none data-[hidden]:hidden"
          >
            <PanelSourceTab detail={detail} placeholder={placeholder} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </>
  );
}
