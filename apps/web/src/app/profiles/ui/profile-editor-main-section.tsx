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
import { WorkflowGraphPersisted } from '@/components/workflow-graph/reactflow/types';
import { SearchList } from '@/components/search-list';
import { refreshNodesByDomainAtomFamily } from '@/models/nodes/list-detail.atom';
import {
  evaluationProfileNodeTypesAtom,
  refreshEvaluationProfileNodeTypesAtom,
} from '@/models/evaluation-profile/list-detail.atom';

export function ProfileWorkflowEditorBlock(props: {
  workflow: WorkflowGraphPersisted;
  canvasKey: number;
  canvasRef: RefObject<WorkflowGraphCanvasHandle | null>;
  className?: string;
  /** 为 true 时仅渲染只读画布（不展示左侧节点列表与编辑工具栏相关项） */
  readOnly?: boolean;
}) {
  const { workflow, canvasKey, canvasRef, className, readOnly = false } = props;

  const { items: catalog } = useAtomValue(evaluationProfileNodeTypesAtom);
  const refreshCatalog = useSetAtom(refreshEvaluationProfileNodeTypesAtom);
  const refreshProfileNodes = useSetAtom(refreshNodesByDomainAtomFamily('evaluation-profile'));

  const catalogPending = catalog === null;
  const nodeTypes = useMemo(() => toWorkflowNodeTypes(catalog ?? []), [catalog]);

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <div
        className={cn(
          'flex min-h-0 flex-1 overflow-hidden',
          !readOnly && !catalogPending && 'flex-row items-stretch gap-3',
        )}
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
          initialGraph={workflow}
          readOnly={readOnly}
          resolveNodeTypeDefinition={async (typeKey) => toWorkflowNodeType(await getNode(typeKey))}
          resolveNodeTypeDefinitions={async (typeKeys) =>
            (await getNodesDetailBatch(typeKeys)).map((detail) => toWorkflowNodeType(detail))
          }
          onRefreshNodeDefinitions={
            readOnly
              ? undefined
              : async () => {
                  const next = await refreshProfileNodes();
                  void refreshCatalog();
                  return toWorkflowNodeTypes(next);
                }
          }
          className="h-full min-h-0 flex-1"
        />
      </div>
    </div>
  );
}
