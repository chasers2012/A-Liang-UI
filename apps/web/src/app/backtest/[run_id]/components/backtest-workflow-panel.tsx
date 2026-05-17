'use client';

import { useCallback, useEffect, useState } from 'react';

import { getBacktestNodeOutput } from '@/api/backtests';
import { EmptyState, PanelPlaceholder } from '@/components/empty-state';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { WorkflowGraphCanvas, toWorkflowNodeTypes } from '@/components/workflow-graph';
import type { WorkflowSocketDefinition } from '@/components/workflow-graph/types';
import type { WorkflowGraphPersisted } from '@/components/workflow-graph/reactflow/types';
import type { BacktestNodeOutputFile } from '@/models/backtest/dto';
import { NodeOutputFilesList } from './node-output-files-list';
import { resolveWorkflowPanelStateView } from './workflow-panel-state-view';
import type { StrategyDetailPanelData } from '../types';

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
    <div className="space-y-3">
      <div className="h-[560px] min-h-[400px]">
        <WorkflowGraphCanvas
          key={safeStrategyDetail.updated_at}
          nodeTypes={strategyNodeTypes}
          initialGraph={safeStrategyDetail.workflow as WorkflowGraphPersisted}
          readOnly
          className="h-full w-full"
          onNodeSelect={onSelectNode}
        />
      </div>
      <div className="rounded-md border bg-background p-3">
        {!selectedNode ? (
          <PanelPlaceholder title="请选择节点" description="选择一个节点以查看后端保存的输出。" />
        ) : loadingOutput ? (
          <EmptyState variant="loading" title="加载中" description="正在加载节点输出…" compact />
        ) : outputError ? (
          <Alert variant="destructive">
            <AlertTitle>加载失败</AlertTitle>
            <AlertDescription>{outputError}</AlertDescription>
          </Alert>
        ) : outputFiles && outputFiles.length > 0 ? (
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
        ) : (
          <EmptyState title="暂无输出" description="该节点暂无已保存输出。" compact />
        )}
      </div>
    </div>
  );
}
