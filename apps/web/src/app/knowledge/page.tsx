'use client';

import { useEffect } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';

import { Page } from '@/components/page';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import {
  createKnowledgeDocumentAtom,
  deleteKnowledgeDocumentAtom,
  knowledgePageAtom,
  refreshKnowledgePageAtom,
  reindexKnowledgeDocumentAtom,
  searchKnowledgeAtom,
  setKnowledgeCreateFieldAtom,
  setKnowledgeFileAtom,
  setKnowledgeSearchQueryAtom,
} from '@/models/knowledge/list-detail.atom';

function toLocalTime(v: string): string {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString();
}

type KnowledgeActions = {
  createDoc: () => void;
  reindexDoc: (id: string) => void;
  deleteDoc: (id: string) => void;
  search: () => void;
  setCreateField: (payload: { key: 'name' | 'source_path'; value: string }) => void;
  setFile: (file: File) => void;
  setSearchQuery: (value: string) => void;
};

function CreateDocumentCard({
  loading,
  createForm,
  actions,
}: {
  loading: boolean;
  createForm: { name: string; source_path: string; auto_index: boolean; file_name: string; file: File | null };
  actions: KnowledgeActions;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>新增文档</CardTitle>
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
              if (file) {
                actions.setFile(file);
              }
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
        <Button onClick={() => actions.createDoc()} disabled={loading}>
          上传并创建文档
        </Button>
      </CardContent>
    </Card>
  );
}

function DocumentsCard({
  documents,
  busyDocumentId,
  actions,
}: {
  documents: Array<{ id: string; name: string; source_path: string | null; status: string; updated_at: string }>;
  busyDocumentId: string | null;
  actions: KnowledgeActions;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>文档列表</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {!documents.length ? (
          <p className="p-6 text-sm text-muted-foreground">暂无文档。</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>更新时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((doc) => {
                const isBusy = busyDocumentId === doc.id;
                return (
                  <TableRow key={doc.id}>
                    <TableCell>
                      <div className="font-medium">{doc.name}</div>
                      <div className="text-xs text-muted-foreground">{doc.source_path || '-'}</div>
                    </TableCell>
                    <TableCell>{doc.status}</TableCell>
                    <TableCell>{toLocalTime(doc.updated_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isBusy}
                          onClick={() => actions.reindexDoc(doc.id)}
                        >
                          重建索引
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={isBusy}
                          onClick={() => actions.deleteDoc(doc.id)}
                        >
                          删除
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
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
  hits: Array<{ chunk_id: string; document_name: string; document_id: string; score: number; content: string }>;
  loading: boolean;
  actions: KnowledgeActions;
}) {
  return (
    <Card>
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
            {hits.map((hit) => (
              <Card key={hit.chunk_id}>
                <CardContent className="space-y-1 p-4">
                  <div className="text-sm">
                    <span className="font-medium">{hit.document_name || hit.document_id}</span>
                    <span className="ml-2 text-muted-foreground">score: {hit.score.toFixed(3)}</span>
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
  const reindexDoc = useSetAtom(reindexKnowledgeDocumentAtom);
  const deleteDoc = useSetAtom(deleteKnowledgeDocumentAtom);
  const search = useSetAtom(searchKnowledgeAtom);
  const setCreateField = useSetAtom(setKnowledgeCreateFieldAtom);
  const setFile = useSetAtom(setKnowledgeFileAtom);
  const setSearchQuery = useSetAtom(setKnowledgeSearchQueryAtom);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const actions: KnowledgeActions = {
    createDoc: () => void createDoc(),
    reindexDoc: (id) => void reindexDoc(id),
    deleteDoc: (id) => void deleteDoc(id),
    search: () => void search(),
    setCreateField: (payload) => setCreateField(payload),
    setFile: (file) => void setFile(file),
    setSearchQuery: (value) => setSearchQuery(value),
  };

  return (
    <Page title="知识库" description="管理 RAG 文档与检索结果。">
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>操作失败</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <CreateDocumentCard loading={loading} createForm={createForm} actions={actions} />
      <DocumentsCard documents={documents} busyDocumentId={busyDocumentId} actions={actions} />
      <SearchCard query={searchForm.query} hits={hits} loading={loading} actions={actions} />
    </Page>
  );
}
