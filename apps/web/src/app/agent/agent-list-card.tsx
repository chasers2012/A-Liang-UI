'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createAgentWorkflow, deleteAgentWorkflow, listAgentWorkflows } from '@/api/agent-workflows';
import type { AgentWorkflowSummaryPublic } from '@/models/agent-workflow/dto';

export interface AgentListCardProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
  refreshKey?: number;
}

export function AgentListCard({ selectedId, onSelect, refreshKey }: AgentListCardProps) {
  const [items, setItems] = useState<AgentWorkflowSummaryPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AgentWorkflowSummaryPublic | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listAgentWorkflows();
      setItems(data);
      if (data.length > 0 && !selectedId) {
        onSelect(data[0].id);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedId, onSelect]);

  useEffect(() => {
    void fetchList();
  }, [fetchList, refreshKey]);

  async function handleCreate() {
    if (!createName.trim()) return;
    setCreating(true);
    try {
      const created = await createAgentWorkflow({ name: createName.trim() });
      setCreateOpen(false);
      setCreateName('');
      await fetchList();
      onSelect(created.id);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteAgentWorkflow(deleteTarget.id);
      setDeleteTarget(null);
      if (selectedId === deleteTarget.id) {
        const remaining = items.filter((i) => i.id !== deleteTarget.id);
        onSelect(remaining.length > 0 ? remaining[0].id : '');
      }
      await fetchList();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Card className="max-w-xs shrink-0 flex flex-col" size="sm">
        <CardHeader>
          <CardTitle>Agent 列表</CardTitle>
          <CardAction>
            <Button variant="ghost" size="icon-xs" onClick={() => setCreateOpen(true)}>
              <Plus />
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-0">
          {loading && items.length === 0 ? (
            <div className="px-3 py-4 text-muted-foreground text-xs text-center">加载中…</div>
          ) : items.length === 0 ? (
            <div className="px-3 py-4 text-muted-foreground text-xs text-center">暂无 Agent</div>
          ) : (
            <ul className="flex flex-col">
              {items.map((item) => (
                <li key={item.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    className={`group w-full flex items-center justify-between gap-1 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60 cursor-pointer outline-none ${
                      item.id === selectedId ? 'bg-muted font-medium' : ''
                    }`}
                    onClick={() => onSelect(item.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelect(item.id);
                      }
                    }}
                  >
                    <span className="truncate">{item.name}</span>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="opacity-0 group-hover:opacity-100 shrink-0 hover:text-destructive [li:hover_&]:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(item);
                      }}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent size="sm">
          <DialogHeader title="新建 Agent" />
          <DialogBody variant="inset">
            <div className="space-y-2">
              <Label htmlFor="agent-name">名称</Label>
              <Input
                id="agent-name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="例如：因子挖掘"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleCreate();
                }}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button disabled={!createName.trim() || creating} onClick={() => void handleCreate()}>
              {creating ? '创建中…' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="删除 Agent"
        description={
          <>
            确定要删除 <strong>{deleteTarget?.name}</strong> 吗？此操作不可撤销。
          </>
        }
        confirmLabel="删除"
        confirmVariant="destructive"
        loading={deleting}
        loadingLabel="删除中…"
        onConfirm={() => void handleDelete()}
      />
    </>
  );
}
