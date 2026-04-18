'use client';

import { useEffect, useRef, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';

import { Page } from '@/components/page';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Item, ItemContent, ItemGroup, ItemHeader, ItemTitle } from '@/components/ui/item';

import {
  addKnowledgeFilesAtom,
  createKnowledgeDocumentAtom,
  deleteKnowledgeDocumentAtom,
  knowledgePageAtom,
  refreshKnowledgePageAtom,
  removeKnowledgeFileAtom,
  searchKnowledgeAtom,
  setKnowledgeSearchQueryAtom,
} from '@/models/knowledge/list-detail.atom';
import { useKnowledgeDocumentsPolling } from '@/models/knowledge/use-knowledge-documents-polling';
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
  addFiles: (files: File[]) => void;
  removeFile: (index: number) => void;
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
  createForm: { files: Array<{ name: string; file_name: string; file: File }> };
  onClose: () => void;
  actions: KnowledgeActions;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <DialogContent size="lg" className="gap-0">
        <DialogHeader title="新增文档">拖放多个文件到下方区域即可批量上传，文档名称会自动使用文件名。</DialogHeader>
        <DialogBody variant="inset">
          <div className="space-y-4">
            <div
              className={`rounded-xl border-2 border-dashed p-6 transition-colors ${
                dragActive ? 'border-primary bg-primary/5' : 'border-border bg-muted/20'
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragEnter={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setDragActive(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                actions.addFiles(Array.from(e.dataTransfer.files));
              }}
              onClick={() => inputRef.current?.click()}
            >
              <input
                ref={inputRef}
                className="hidden"
                type="file"
                multiple
                accept=".txt,.md,.markdown,.csv,.json,.pdf,.docx,.html,.htm"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (files.length) actions.addFiles(files);
                  e.currentTarget.value = '';
                }}
              />
              <div className="text-center">
                <div className="text-sm font-medium">拖拽文件到这里，或点击选择文件</div>
                <p className="mt-1 text-xs text-muted-foreground">支持批量上传：TXT、MD、CSV、JSON、PDF、DOCX、HTML</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">上传文件列表</div>
              {!createForm.files.length ? (
                <p className="text-sm text-muted-foreground">还没有选择文件。</p>
              ) : (
                <div className="h-64 space-y-2 overflow-y-auto pr-1">
                  {createForm.files.map((item, index) => (
                    <div
                      key={`${item.file_name}-${index}`}
                      className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{item.file_name}</div>
                        <div className="truncate text-xs text-muted-foreground">{item.name}</div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => actions.removeFile(index)} disabled={loading}>
                        删除
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            取消
          </Button>
          <Button onClick={() => actions.createDoc()} disabled={loading || !createForm.files.length}>
            上传并创建文档
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DocumentsCard({
  documents,
  busyDocumentId,
  onAdd,
  actions,
}: {
  documents: Array<{ id: string; name: string; status: string; updated_at: string }>;
  busyDocumentId: string | null;
  onAdd: () => void;
  actions: KnowledgeActions;
}) {
  const pendingDocuments = documents.filter((doc) => doc.status !== 'indexed');
  const indexedDocuments = documents.filter((doc) => doc.status === 'indexed');

  const renderDocumentItem = (doc: { id: string; name: string; status: string; updated_at: string }) => {
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
  const addFiles = useSetAtom(addKnowledgeFilesAtom);
  const removeFile = useSetAtom(removeKnowledgeFileAtom);
  const setSearchQuery = useSetAtom(setKnowledgeSearchQueryAtom);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useKnowledgeDocumentsPolling(refresh);

  const actions: KnowledgeActions = {
    createDoc: () => void createDoc(),
    deleteDoc: (id) => void deleteDoc(id),
    search: () => void search(),
    addFiles: (files) => void addFiles(files),
    removeFile: (index) => void removeFile(index),
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
