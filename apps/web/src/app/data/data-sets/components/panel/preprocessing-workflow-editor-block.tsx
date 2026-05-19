'use client';

import { useEffect, useMemo, useState, type RefObject } from 'react';
import { useSetAtom } from 'jotai';

import { cn } from '@/lib/utils';
import { getNode, getNodesDetailBatch, listNodes } from '@/api/nodes';

import {
  WORKFLOW_GRAPH_NODE_DRAG_MIME,
  WorkflowGraphCanvas,
  type WorkflowGraphCanvasHandle,
  toWorkflowNodeType,
  toWorkflowNodeTypes,
} from '@/components/workflow-graph';
import { WorkflowGraphPersisted } from '@/components/workflow-graph/reactflow/types';
import { NodeSummaryPublic } from '@/models/nodes/dto';
import { SearchListEmpty } from '@/components/empty-state';
import { SearchList, SearchListItem } from '@/components/search-list';
import { refreshNodesByDomainAtomFamily } from '@/models/nodes/list-detail.atom';

export function PreprocessingWorkflowEditorBlock(props: {
  workflow: WorkflowGraphPersisted;
  canvasKey: number;
  canvasRef: RefObject<WorkflowGraphCanvasHandle | null>;
  className?: string;
  readOnly?: boolean;
}) {
  const { workflow, canvasKey, canvasRef, className, readOnly = false } = props;

  const [catalog, setCatalog] = useState<NodeSummaryPublic[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const refreshPreprocessorNodes = useSetAtom(refreshNodesByDomainAtomFamily('preprocessors'));

  useEffect(() => {
    void listNodes('preprocessors')
      .then(setCatalog)
      .finally(() => setCatalogLoading(false));
  }, []);

  const nodeTypes = useMemo(() => toWorkflowNodeTypes(catalog), [catalog]);

  const preprocessorSearchListEmpty = catalogLoading
    ? { variant: 'loading' as const, title: '加载中', description: '正在加载预处理器节点…' }
    : nodeTypes.length === 0
      ? { title: '暂无预处理器节点' }
      : { title: '无匹配结果', description: '没有符合搜索条件的节点' };

  return (
    <div className={cn('flex h-full min-h-0 flex-1 flex-col gap-3', className)}>
      <div className="flex h-full min-h-0 flex-1 items-stretch gap-3 overflow-hidden">
        {!readOnly ? (
          <SearchList
            items={catalogLoading ? null : nodeTypes}
            className="w-[300px]"
            title="预处理器节点"
            searchPlaceholder="搜索节点/描述"
            getGroupKey={(item) => item.category ?? '未分类'}
            searchKeys={['label', 'description', 'category']}
            renderItem={({ item, selectedId }) => (
              <SearchListItem
                item={item}
                selectedId={selectedId}
                title={item.label}
                description={item.description ?? ''}
                draggable
                onClick={() => canvasRef.current?.addNode(item.id)}
                onDragStart={(e) => {
                  e.dataTransfer.setData(WORKFLOW_GRAPH_NODE_DRAG_MIME, item.id);
                  e.dataTransfer.effectAllowed = 'copy';
                }}
              />
            )}
          >
            <SearchListEmpty {...preprocessorSearchListEmpty} />
          </SearchList>
        ) : null}
        <WorkflowGraphCanvas
          key={canvasKey}
          ref={canvasRef}
          readOnly={readOnly}
          nodeTypes={nodeTypes}
          initialGraph={workflow}
          resolveNodeTypeDefinition={async (typeKey) => toWorkflowNodeType(await getNode(typeKey))}
          resolveNodeTypeDefinitions={async (typeKeys) =>
            (await getNodesDetailBatch(typeKeys)).map((detail) => toWorkflowNodeType(detail))
          }
          onRefreshNodeDefinitions={async () => toWorkflowNodeTypes(await refreshPreprocessorNodes())}
          className="h-full flex-1"
        />
      </div>
    </div>
  );
}
