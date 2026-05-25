'use client';

import { useMemo, useState } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { Plus } from 'lucide-react';

import { SearchListEmpty, resolveAsyncListEmptyState } from '@/components/empty-state';
import { CollapsibleSidebar } from '@/components/collapsible-sidebar';
import { SearchList } from '@/components/search-list';
import {
  deleteKnowledgeDocumentAtom,
  knowledgePageAtom,
  knowledgeSelectedIdAtom,
} from '@/models/knowledge/list-detail.atom';

import { CreateDocumentDialog } from './create-document-dialog';
import {
  formatKnowledgeDocumentDescription,
  KnowledgeDocumentListItem,
  knowledgeDocumentStatusGroup,
} from './knowledge-document-list-item';

export function KnowledgeListPane() {
  const { documents, loading, error, busyDocumentId } = useAtomValue(knowledgePageAtom);
  const [selectedId, setSelectedId] = useAtom(knowledgeSelectedIdAtom);
  const deleteDoc = useSetAtom(deleteKnowledgeDocumentAtom);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const listItems = useMemo(() => {
    if (loading && documents.length === 0) return null;
    return documents.map((doc) => ({
      id: doc.id,
      label: doc.name,
      description: formatKnowledgeDocumentDescription(doc.status, doc.updated_at),
      status: doc.status,
    }));
  }, [documents, loading]);

  const knowledgeSearchListEmpty = resolveAsyncListEmptyState({
    loading: listItems == null,
    error: error && documents.length === 0 ? error : null,
    itemCount: documents.length,
    emptyTitle: '暂无文档',
    emptyDescription: '请使用右上角「新增文档」上传知识库文件。',
    filterEmptyDescription: '没有符合当前筛选条件的文档。',
  });

  return (
    <>
      <CollapsibleSidebar collapsed={false} drawerTitle="知识库">
        <SearchList
          className="h-full min-h-0"
          items={listItems}
          getGroupKey={(item) => knowledgeDocumentStatusGroup(item.status)}
          searchKeys={['label', 'description', 'status', 'id']}
          title="文档列表"
          searchPlaceholder="搜索文档"
          selectedId={selectedId}
          renderItem={(params) => (
            <KnowledgeDocumentListItem
              {...params}
              busyDocumentId={busyDocumentId}
              onSelect={setSelectedId}
              onDelete={(id) => void deleteDoc(id)}
            />
          )}
          actions={[
            {
              label: '新增文档',
              icon: Plus,
              variant: 'default',
              size: 'icon',
              onClick: () => setCreateDialogOpen(true),
            },
          ]}
        >
          <SearchListEmpty {...knowledgeSearchListEmpty} />
        </SearchList>
      </CollapsibleSidebar>

      <CreateDocumentDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onCreated={() => setCreateDialogOpen(false)}
      />
    </>
  );
}
