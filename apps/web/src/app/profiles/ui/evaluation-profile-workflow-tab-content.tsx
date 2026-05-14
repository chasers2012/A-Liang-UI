'use client';

import { useMemo, type RefObject } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';

import { cn } from '@/lib/utils';
import { getNode, getNodesDetailBatch } from '@/api/nodes';
import {
  WORKFLOW_GRAPH_NODE_DRAG_MIME,
  WorkflowGraphCanvas,
  type WorkflowGraphCanvasHandle,
  toWorkflowNodeType,
  toWorkflowNodeTypes,
} from '@/components/workflow-graph';
import { SearchList } from '@/components/search-list';
import { refreshNodesByDomainAtomFamily } from '@/models/nodes/list-detail.atom';
import { nodeTypesAtom, refreshNodeTypesAtom } from '@/models/evaluation-profile/list-detail.atom';
import { workflowDerivedAtom } from '@/models/evaluation-profile/workflow.atom';
import { loadingAtom } from '@/models/evaluation-profile/scope.atom';

export function EvaluationProfileWorkflowTabContent(props: {
  canvasKey: number;
  canvasRef: RefObject<WorkflowGraphCanvasHandle | null>;
}) {
  const { canvasKey, canvasRef } = props;
  const {
    workflow: workflowForCanvas,
    workflowGraphAvailable: showCanvas,
    workflowReadOnly: readOnly,
  } = useAtomValue(workflowDerivedAtom);
  const panelLoading = useAtomValue(loadingAtom);

  const catalog = useAtomValue(nodeTypesAtom);
  const refreshCatalog = useSetAtom(refreshNodeTypesAtom);
  const refreshProfileNodes = useSetAtom(refreshNodesByDomainAtomFamily('evaluation-profile'));
  const catalogPending = catalog === null;
  const nodeTypes = useMemo(() => toWorkflowNodeTypes(catalog ?? []), [catalog]);

  if (panelLoading) return null;

  if (!showCanvas) {
    return <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden" />;
  }

  return (
    <div
      className={cn('flex min-h-0 flex-1 overflow-hidden', {
        'flex-row items-stretch gap-3': !readOnly && !catalogPending,
      })}
    >
      {!readOnly && !catalogPending ? (
        <SearchList
          className="w-[300px] shrink-0"
          items={nodeTypes}
          title="评估配置节点"
          searchPlaceholder="搜索节点/描述"
          getGroupKey={(item) => item.category ?? '未分类'}
          renderTitle={(item) => item.label}
          renderDescription={(item) => item.description ?? ''}
          getSearchText={(item) => [item.label, item.description ?? '', item.category ?? ''].join(' ')}
          onItemSelected={(item) => canvasRef.current?.addNode(item.id)}
          onItemDrag={(item, e) => {
            e.dataTransfer.setData(WORKFLOW_GRAPH_NODE_DRAG_MIME, item.id);
            e.dataTransfer.effectAllowed = 'copy';
          }}
        />
      ) : null}
      <WorkflowGraphCanvas
        key={canvasKey}
        ref={canvasRef}
        nodeTypes={nodeTypes}
        initialGraph={workflowForCanvas}
        readOnly={readOnly}
        resolveNodeTypeDefinition={async (typeKey) => toWorkflowNodeType(await getNode(typeKey))}
        resolveNodeTypeDefinitions={async (typeKeys) =>
          (await getNodesDetailBatch(typeKeys)).map((detail) => toWorkflowNodeType(detail))
        }
        onRefreshNodeDefinitions={async () => {
          const next = await refreshProfileNodes();
          void refreshCatalog();
          return toWorkflowNodeTypes(next);
        }}
        className="h-full min-h-0 flex-1"
      />
    </div>
  );
}
