'use client';

import { useCallback, useEffect, useState } from 'react';

import { getBacktestNodeOutput } from '@/api/backtests';
import { EmptyState, PanelPlaceholder } from '@/components/empty-state';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WorkflowGraphCanvas, toWorkflowNodeTypes } from '@/components/workflow-graph';
import type { WorkflowSocketDefinition } from '@/components/workflow-graph/types';
import type { WorkflowGraphPersisted } from '@/components/workflow-graph/reactflow/types';
import type { BacktestNodeOutputFile } from '@/models/backtest/dto';
import { NodeOutputFilesList } from './node-output-files-list';
import { resolveWorkflowPanelStateView } from './workflow-panel-state-view';
import type { StrategyDetailPanelData } from '../types';

type StrategySubTab = 'workflow' | 'output';

function BacktestNodeOutputPanel({
  selectedNode,
  loadingOutput,
  outputError,
  outputFiles,
  runId,
}: {
  selectedNode: { id: string; label?: string | null; outputs?: WorkflowSocketDefinition[] } | null;
  loadingOutput: boolean;
  outputError: string | null;
  outputFiles: BacktestNodeOutputFile[] | null;
  runId: string;
}) {
  if (!selectedNode) {
    return <PanelPlaceholder title="请选择节点" description="在工作流图中选择一个节点以查看输出。" />;
  }
  if (loadingOutput) {
    return <EmptyState variant="loading" title="加载中" description="正在加载节点输出…" compact />;
  }
  if (outputError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>加载失败</AlertTitle>
        <AlertDescription className="break-words whitespace-pre-wrap">{outputError}</AlertDescription>
      </Alert>
    );
  }
  if (outputFiles && outputFiles.length > 0) {
    return (
      <div className="space-y-3">
        <div className="text-sm">
          <span className="text-muted-foreground">节点：</span>
          <span className="font-medium">{selectedNode.label ?? selectedNode.id}</span>
        </div>
        <NodeOutputFilesList
          runId={runId}
          nodeId={selectedNode.id}
          files={outputFiles}
          nodeOutputs={selectedNode.outputs ?? []}
        />
      </div>
    );
  }
  return <EmptyState title="暂无输出" description="该节点暂无已保存输出。" compact />;
}

export function BacktestWorkflowPanel({
  runId,
  strategyId,
  strategyDetail,
  strategyError,
  strategyNodeCatalog,
  strategyNodeCatalogError,
  strategyNodeTypes,
}: {
  runId: string;
  strategyId: string;
  strategyDetail: StrategyDetailPanelData | null;
  strategyError: string | null;
  strategyNodeCatalog: unknown[] | null;
  strategyNodeCatalogError: string | null;
  strategyNodeTypes: ReturnType<typeof toWorkflowNodeTypes>;
}) {
  const [subTab, setSubTab] = useState<StrategySubTab>('workflow');
  const [selectedNode, setSelectedNode] = useState<{
    id: string;
    label?: string | null;
    outputs?: WorkflowSocketDefinition[];
  } | null>(null);
  const [outputFiles, setOutputFiles] = useState<BacktestNodeOutputFile[] | null>(null);
  const [loadingOutput, setLoadingOutput] = useState(false);
  const [outputError, setOutputError] = useState<string | null>(null);

  const onSelectNode = useCallback(
    (node: { id: string; label?: string | null; outputs?: WorkflowSocketDefinition[] }) => {
      setSelectedNode(node);
      setOutputFiles(null);
      setLoadingOutput(true);
      setOutputError(null);
      setSubTab('output');
    },
    [],
  );

  useEffect(() => {
    if (!selectedNode?.id || !runId) return;
    let cancelled = false;
    void getBacktestNodeOutput(runId, selectedNode.id)
      .then((res) => {
        if (cancelled) return;
        setOutputFiles(res.files ?? []);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setOutputError(e instanceof Error ? e.message : String(e));
        setOutputFiles(null);
      })
      .finally(() => {
        if (cancelled) return;
        setLoadingOutput(false);
      });
    return () => {
      cancelled = true;
    };
  }, [runId, selectedNode?.id]);

  const stateView = resolveWorkflowPanelStateView({
    strategyId,
    strategyError,
    strategyDetail,
    strategyNodeCatalog,
    strategyNodeCatalogError,
  });
  if (stateView) return stateView;

  const safeStrategyDetail = strategyDetail as NonNullable<typeof strategyDetail>;

  return (
    <Tabs
      value={subTab}
      onValueChange={(v) => {
        if (v === 'workflow' || v === 'output') setSubTab(v);
      }}
      className="flex h-full min-h-0 flex-1 flex-col gap-2 overflow-hidden"
    >
      <TabsList className="h-8 w-fit shrink-0">
        <TabsTrigger value="workflow">工作流</TabsTrigger>
        <TabsTrigger value="output" disabled={!selectedNode}>
          节点结果
        </TabsTrigger>
      </TabsList>

      <TabsContent value="workflow" className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden data-hidden:hidden">
        <WorkflowGraphCanvas
          key={safeStrategyDetail.updated_at}
          nodeTypes={strategyNodeTypes}
          initialGraph={safeStrategyDetail.workflow as WorkflowGraphPersisted}
          readOnly
          className="h-full min-h-0 w-full flex-1"
          onNodeSelect={onSelectNode}
        />
      </TabsContent>

      <TabsContent
        value="output"
        className="mt-0 min-h-0 flex-1 overflow-y-auto rounded-md border bg-background p-3 data-hidden:hidden"
      >
        <BacktestNodeOutputPanel
          selectedNode={selectedNode}
          loadingOutput={loadingOutput}
          outputError={outputError}
          outputFiles={outputFiles}
          runId={runId}
        />
      </TabsContent>
    </Tabs>
  );
}
