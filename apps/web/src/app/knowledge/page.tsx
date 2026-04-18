'use client';

import { useEffect, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';

import { Page } from '@/components/page';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Item, ItemActions, ItemContent, ItemGroup, ItemHeader, ItemTitle } from '@/components/ui/item';

import {
  createKnowledgeDocumentAtom,
  deleteKnowledgeDocumentAtom,
  knowledgePageAtom,
  refreshKnowledgePageAtom,
  searchKnowledgeAtom,
  setKnowledgeCreateFieldAtom,
  setKnowledgeFileAtom,
  setKnowledgeSearchQueryAtom,
} from '@/models/knowledge/list-detail.atom';
import { Trash } from 'lucide-react';

function toLocalTime(v: string): string {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString();
}

type KnowledgeActions = {
  createDoc: () => void;
  deleteDoc: (id: string) => void;
  search: () => void;
  setCreateField: (payload: { key: 'name' | 'source_path' | 'auto_index'; value: string | boolean }) => void;
  setFile: (file: File) => void;
  setSearchQuery: (value: string) => void;
};

function CreateDocumentDialog({
  open,
  loading,
  createForm,
  onClose,
  actions,
}: {
  open: boolean;
  loading: boolean;
  createForm: { name: string; source_path: string; auto_index: boolean; file_name: string; file: File | null };
  onClose: () => void;
  actions: KnowledgeActions;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-lg bg-background shadow-lg">
        <Card className="border-0 shadow-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>新增文档</CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              关闭
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="knowledge-file">上传文件</Label>
              <Input
                id="knowledge-file"
                type="file"
                accept=".txt,.md,.markdown,.csv,.json,.pdf,.docx,.html,.htm"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) actions.setFile(file);
                }}
              />
              {createForm.file_name ? (
                <p className="text-xs text-muted-foreground">已选择: {createForm.file_name}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="knowledge-name">名称</Label>
              <Input
                id="knowledge-name"
                value={createForm.name}
                onChange={(e) => actions.setCreateField({ key: 'name', value: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="knowledge-source-path">来源路径（可选）</Label>
              <Input
                id="knowledge-source-path"
                value={createForm.source_path}
                onChange={(e) => actions.setCreateField({ key: 'source_path', value: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Input
                id="knowledge-auto-index"
                type="checkbox"
                className="h-4 w-4"
                checked={createForm.auto_index}
                onChange={(e) => actions.setCreateField({ key: 'auto_index', value: e.target.checked })}
              />
              <Label htmlFor="knowledge-auto-index">创建后自动建立索引</Label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={onClose} disabled={loading}>
                取消
              </Button>
              <Button onClick={() => actions.createDoc()} disabled={loading}>
                上传并创建文档
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DocumentsCard({
  documents,
  busyDocumentId,
  onAdd,
  actions,
}: {
  documents: Array<{ id: string; name: string; source_path: string | null; status: string; updated_at: string }>;
  busyDocumentId: string | null;
  onAdd: () => void;
  actions: KnowledgeActions;
}) {
  const pendingDocuments = documents.filter((doc) => doc.status !== 'indexed');
  const indexedDocuments = documents.filter((doc) => doc.status === 'indexed');

  const renderDocumentItem = (doc: {
    id: string;
    name: string;
    source_path: string | null;
    status: string;
    updated_at: string;
  }) => {
    const isBusy = busyDocumentId === doc.id;

    return (
      <Item key={doc.id} variant="outline" size="sm" className="items-start">
        <ItemContent>
          <ItemHeader>
            <div className="min-w-0 flex-1">
              <ItemTitle>{doc.name}</ItemTitle>
              <div className="mt-1 text-xs text-muted-foreground">{toLocalTime(doc.updated_at)}</div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => actions.deleteDoc(doc.id)} disabled={isBusy}>
                <Trash className="h-4 w-4" />
              </Button>
            </div>
          </ItemHeader>
          <ItemActions />
        </ItemContent>
      </Item>
    );
  };

  return (
    <Card className="h-full w-[300px] min-h-0">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>文档列表</CardTitle>
          <Button onClick={onAdd}>新增文档</Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {!documents.length ? (
          <p className="p-6 text-sm text-muted-foreground">暂无文档。</p>
        ) : (
          <div className="space-y-4 p-2">
            {pendingDocuments.length ? (
              <div className="space-y-2">
                <div className="px-2 text-xs font-medium text-muted-foreground">未完成索引</div>
                <ItemGroup className="gap-2">{pendingDocuments.map(renderDocumentItem)}</ItemGroup>
              </div>
            ) : null}
            {indexedDocuments.length ? (
              <div className="space-y-2">
                <div className="px-2 text-xs font-medium text-muted-foreground">已完成索引</div>
                <ItemGroup className="gap-2">{indexedDocuments.map(renderDocumentItem)}</ItemGroup>
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SearchCard({
  query,
  hits,
  loading,
  actions,
}: {
  query: string;
  hits: Array<{ document_name: string; content: string }>;
  loading: boolean;
  actions: KnowledgeActions;
}) {
  return (
    <Card className="h-full flex-1">
      <CardHeader>
        <CardTitle>知识检索</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-2">
            <Label htmlFor="knowledge-search">Query</Label>
            <Input id="knowledge-search" value={query} onChange={(e) => actions.setSearchQuery(e.target.value)} />
          </div>
          <Button variant="outline" onClick={() => actions.search()} disabled={loading}>
            检索
          </Button>
        </div>
        {!hits.length ? (
          <p className="text-sm text-muted-foreground">暂无命中结果。</p>
        ) : (
          <div className="space-y-2">
            {hits.map((hit, index) => (
              <Card key={`${hit.document_name || 'hit'}-${index}`}>
                <CardContent className="space-y-1 p-4">
                  <div className="text-sm">
                    <span className="font-medium">{hit.document_name || `命中结果 ${index + 1}`}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{hit.content}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function KnowledgePage() {
  const { documents, hits, loading, error, busyDocumentId, createForm, searchForm } = useAtomValue(knowledgePageAtom);
  const refresh = useSetAtom(refreshKnowledgePageAtom);
  const createDoc = useSetAtom(createKnowledgeDocumentAtom);
  const deleteDoc = useSetAtom(deleteKnowledgeDocumentAtom);
  const search = useSetAtom(searchKnowledgeAtom);
  const setCreateField = useSetAtom(setKnowledgeCreateFieldAtom);
  const setFile = useSetAtom(setKnowledgeFileAtom);
  const setSearchQuery = useSetAtom(setKnowledgeSearchQueryAtom);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const actions: KnowledgeActions = {
    createDoc: () => void createDoc(),
    deleteDoc: (id) => void deleteDoc(id),
    search: () => void search(),
    setCreateField: (payload) => setCreateField(payload),
    setFile: (file) => void setFile(file),
    setSearchQuery: (value) => setSearchQuery(value),
  };

  const handleCreate = async () => {
    await createDoc();
    setCreateDialogOpen(false);
  };

  return (
    <Page size="full" className="h-full">
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>操作失败</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-row flex-1 w-full h-full gap-3 overflow-hidden items-stretch">
        <DocumentsCard
          documents={documents}
          busyDocumentId={busyDocumentId}
          onAdd={() => setCreateDialogOpen(true)}
          actions={actions}
        />
        <SearchCard query={searchForm.query} hits={hits} loading={loading} actions={actions} />
      </div>
      <CreateDocumentDialog
        open={createDialogOpen}
        loading={loading}
        createForm={createForm}
        onClose={() => setCreateDialogOpen(false)}
        actions={{ ...actions, createDoc: () => void handleCreate() }}
      />
    </Page>
  );
}
