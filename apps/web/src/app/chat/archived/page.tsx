'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, ArchiveRestore, Trash2 } from 'lucide-react';

import {
  archiveAgentChat,
  listAgentChats,
  listArchivedAgentChats,
  purgeArchivedAgentChat,
  restoreAgentChat,
} from '@/api/chat';
import { Page } from '@/components/page';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ChatArchivedSummaryPublic, ChatSummaryPublic } from '@/models/agent-llm/dto';
import { ApiError } from '@/api/client';

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

type ManagedSession = (ChatSummaryPublic | ChatArchivedSummaryPublic) & {
  is_archived: boolean;
  archived_at: string | null;
};

function toManagedSessions(active: ChatSummaryPublic[], archived: ChatArchivedSummaryPublic[]): ManagedSession[] {
  const activeSessions: ManagedSession[] = active.map((session) => ({
    ...session,
    is_archived: false,
    archived_at: null,
  }));
  const archivedSessions: ManagedSession[] = archived.map((session) => ({
    ...session,
    is_archived: true,
    archived_at: session.archived_at,
  }));
  return [...activeSessions, ...archivedSessions].sort((a, b) => {
    const aTs = new Date(a.archived_at ?? a.updated_at).getTime();
    const bTs = new Date(b.archived_at ?? b.updated_at).getTime();
    return bTs - aTs;
  });
}

export default function ArchivedChatsPage() {
  const [items, setItems] = useState<ManagedSession[] | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<'archive' | 'restore' | 'delete' | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const visibleItems = useMemo(
    () => (items ?? []).filter((session) => (activeTab === 'active' ? !session.is_archived : session.is_archived)),
    [activeTab, items],
  );
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedItems = useMemo(
    () => visibleItems.filter((session) => selectedSet.has(session.id)),
    [visibleItems, selectedSet],
  );

  const allIds = useMemo(() => visibleItems.map((session) => session.id), [visibleItems]);
  const allSelected = allIds.length > 0 && selectedIds.length === allIds.length;
  const isBusy = pendingAction !== null;

  const loadSessions = useCallback(async () => {
    setError(null);
    try {
      const [active, archived] = await Promise.all([listAgentChats(), listArchivedAgentChats()]);
      const merged = toManagedSessions(active, archived);
      setItems(merged);
      setSelectedIds((prev) => prev.filter((id) => merged.some((session) => session.id === id)));
    } catch (e) {
      setItems([]);
      setError(e instanceof ApiError ? e.message : '加载会话失败，请检查网络与 API。');
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSessions();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadSessions]);

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(allIds);
      return;
    }
    setSelectedIds([]);
  };

  const toggleSelectOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((x) => x !== id);
    });
  };

  const runBatchAction = async (action: 'archive' | 'restore' | 'delete') => {
    if (selectedItems.length === 0) return;
    setPendingAction(action);
    setError(null);

    const failures: string[] = [];
    for (const session of selectedItems) {
      try {
        if (action === 'archive') {
          if (session.is_archived) continue;
          await archiveAgentChat(session.id);
          continue;
        }
        if (action === 'restore') {
          if (!session.is_archived) continue;
          await restoreAgentChat(session.id);
          continue;
        }
        if (!session.is_archived) {
          await archiveAgentChat(session.id);
        }
        await purgeArchivedAgentChat(session.id);
      } catch {
        failures.push(session.title || session.id);
      }
    }

    if (failures.length > 0) {
      setError(`部分会话操作失败：${failures.slice(0, 5).join('、')}${failures.length > 5 ? ' 等' : ''}`);
    }

    await loadSessions();
    setPendingAction(null);
  };

  const archiveSelected = () => void runBatchAction('archive');
  const restoreSelected = () => void runBatchAction('restore');
  const deleteSelected = () => {
    setIsDeleteDialogOpen(false);
    void runBatchAction('delete');
  };

  const archiveTargetCount = selectedItems.filter((session) => !session.is_archived).length;
  const restoreTargetCount = selectedItems.filter((session) => session.is_archived).length;

  return (
    <Page
      title="会话管理"
      description={
        <p className="text-sm text-muted-foreground">
          统一管理全部会话，支持批量归档、恢复与删除。恢复后的会话会重新出现在{' '}
          <Link href="/" className="font-medium text-primary underline-offset-4 hover:underline">
            对话
          </Link>{' '}
          页签中。
        </p>
      }
    >
      {error && (
        <Alert variant="destructive">
          <AlertTitle>操作失败</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>会话列表</CardTitle>
          <CardDescription>按标签页查看会话，可多选后执行批量操作。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Tabs
              className="data-horizontal:flex-row items-center"
              value={activeTab}
              onValueChange={(value) => {
                setActiveTab(value as 'active' | 'archived');
                setSelectedIds([]);
              }}
            >
              <TabsList>
                <TabsTrigger value="active">未归档</TabsTrigger>
                <TabsTrigger value="archived">已归档</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex flex-wrap items-center justify-end gap-2">
              {activeTab === 'active' && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={isBusy || archiveTargetCount === 0}
                  onClick={archiveSelected}
                >
                  <Archive className="size-3.5" aria-hidden />
                  {pendingAction === 'archive' ? '归档中…' : `归档 (${archiveTargetCount})`}
                </Button>
              )}
              {activeTab === 'archived' && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={isBusy || restoreTargetCount === 0}
                    onClick={restoreSelected}
                  >
                    <ArchiveRestore className="size-3.5" aria-hidden />
                    {pendingAction === 'restore' ? '恢复中…' : `恢复 (${restoreTargetCount})`}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="gap-1.5"
                    disabled={isBusy || selectedItems.length === 0}
                    onClick={() => setIsDeleteDialogOpen(true)}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                    {pendingAction === 'delete' ? '删除中…' : `删除 (${selectedItems.length})`}
                  </Button>
                </>
              )}
            </div>
          </div>

          {items === null ? (
            <p className="py-6 text-sm text-muted-foreground">加载中…</p>
          ) : visibleItems.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">
              {activeTab === 'active' ? '暂无未归档会话。' : '暂无已归档会话。'}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={(checked) => toggleSelectAll(Boolean(checked))}
                      aria-label="全选会话"
                    />
                  </TableHead>
                  <TableHead>标题</TableHead>
                  <TableHead className="w-24">状态</TableHead>
                  <TableHead className="hidden w-20 sm:table-cell">消息数</TableHead>
                  <TableHead className="hidden w-44 lg:table-cell">更新时间</TableHead>
                  <TableHead className="hidden w-44 lg:table-cell">归档时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleItems.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedSet.has(session.id)}
                        onCheckedChange={(checked) => toggleSelectOne(session.id, Boolean(checked))}
                        aria-label={`选择会话 ${session.title}`}
                      />
                    </TableCell>
                    <TableCell className="max-w-[min(28rem,50vw)] truncate font-medium">{session.title}</TableCell>
                    <TableCell className="w-24">{session.is_archived ? '已归档' : '进行中'}</TableCell>
                    <TableCell className="hidden w-20 text-muted-foreground sm:table-cell">
                      {session.message_count}
                    </TableCell>
                    <TableCell className="hidden w-44 text-muted-foreground lg:table-cell">
                      {formatWhen(session.updated_at)}
                    </TableCell>
                    <TableCell className="hidden w-44 text-muted-foreground lg:table-cell">
                      {session.archived_at ? formatWhen(session.archived_at) : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title="删除会话"
        description={
          <div className="space-y-2">
            <p className="text-sm text-foreground">确认永久删除所选 {selectedItems.length} 个会话？</p>
            <p className="text-sm text-muted-foreground">删除后将无法恢复，历史消息会一并移除。</p>
          </div>
        }
        confirmLabel={pendingAction === 'delete' ? '删除中…' : '删除'}
        onConfirm={deleteSelected}
      />
    </Page>
  );
}
