'use client';

import { useRef, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';

import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog';
import {
  addKnowledgeFilesAtom,
  createKnowledgeDocumentAtom,
  knowledgePageAtom,
  removeKnowledgeFileAtom,
} from '@/models/knowledge/list-detail.atom';

export function CreateDocumentDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { loading, createForm } = useAtomValue(knowledgePageAtom);
  const createDoc = useSetAtom(createKnowledgeDocumentAtom);
  const addFiles = useSetAtom(addKnowledgeFilesAtom);
  const removeFile = useSetAtom(removeKnowledgeFileAtom);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleCreate = async () => {
    await createDoc();
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <DialogContent size="lg" className="gap-0">
        <DialogHeader title="新增文档">拖放多个文件到下方区域即可批量上传，文档名称会自动使用文件名。</DialogHeader>
        <DialogBody variant="inset">
          <div
            className="space-y-4"
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
              addFiles(Array.from(e.dataTransfer.files));
            }}
          >
            <div
              className={`rounded-xl border-2 border-dashed p-6 transition-colors ${
                dragActive ? 'border-primary bg-primary/5' : 'border-border bg-muted/20'
              }`}
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
                  if (files.length) addFiles(files);
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
              <div className="h-64 space-y-2 overflow-y-auto pr-1">
                {createForm.files.length > 0 ? (
                  createForm.files.map((item, index) => (
                    <div
                      key={`${item.file_name}-${index}`}
                      className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{item.file_name}</div>
                        <div className="truncate text-xs text-muted-foreground">{item.name}</div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removeFile(index)} disabled={loading}>
                        删除
                      </Button>
                    </div>
                  ))
                ) : (
                  <EmptyState title="暂无文件" description="选择或拖拽文件到上方区域。" compact className="h-full" />
                )}
              </div>
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            取消
          </Button>
          <Button onClick={() => void handleCreate()} disabled={loading || !createForm.files.length}>
            上传并创建文档
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
