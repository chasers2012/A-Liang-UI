'use client';

import { useEffect, useMemo, useState } from 'react';
import { Archive, ArchiveRestore, Trash2 } from 'lucide-react';
import { useAtomValue, useSetAtom } from 'jotai';

import { batchDeleteAgentChats, batchUpdateAgentChats } from '@/api/chat';
import { Page } from '@/components/page';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { managedSessionsAtom, refreshManagedSessionsAtom } from '@/models/chat/base.atom';

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

const EMPTY_TEXT_BY_TAB: Record<'active' | 'archived', string> = {
  active: '暂无未归档会话。',
  archived: '暂无已归档会话。',
};

export default function ArchivedChatsPage() {
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<'archive' | 'restore' | 'delete' | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const asyncState = useAtomValue(managedSessionsAtom);
  const items = useMemo(() => asyncState.value ?? [], [asyncState.value]);
  const refreshManagedSessions = useSetAtom(refreshManagedSessionsAtom);
  const alertError = error || asyncState.error;

  const visibleItems = useMemo(
    () => items.filter((session) => (activeTab === 'active' ? !session.is_archived : session.is_archived)),
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

  useEffect(() => {
    void refreshManagedSessions();
  }, [refreshManagedSessions]);

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
    try {
      const sessionIds = selectedItems.map((session) => session.id);
      const result =
        action === 'delete'
          ? await batchDeleteAgentChats({ session_ids: sessionIds })
          : await batchUpdateAgentChats({ action, session_ids: sessionIds });
      if (result.failed_ids.length > 0) {
        const failedNames = selectedItems
          .filter((session) => result.failed_ids.includes(session.id))
          .map((session) => session.title || session.id);
        setError(`部分会话操作失败：${failedNames.slice(0, 5).join('、')}${failedNames.length > 5 ? ' 等' : ''}`);
      }
      await refreshManagedSessions();
    } finally {
      setPendingAction(null);
    }
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
    <Page title="会话管理">
      {alertError && (
        <Alert variant="destructive">
          <AlertTitle>操作失败</AlertTitle>
          <AlertDescription>{alertError}</AlertDescription>
        </Alert>
      )}

      <Card>
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

          <SessionsTable
            loading={asyncState.loading}
            emptyText={EMPTY_TEXT_BY_TAB[activeTab]}
            items={visibleItems}
            allSelected={allSelected}
            selectedSet={selectedSet}
            onToggleSelectAll={toggleSelectAll}
            onToggleSelectOne={toggleSelectOne}
          />
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

function SessionsTable(props: {
  loading: boolean;
  emptyText: string;
  items: Array<{
    id: string;
    title: string;
    message_count: number;
    updated_at: string;
    archived_at: string | null;
    is_archived: boolean;
  }>;
  allSelected: boolean;
  selectedSet: Set<string>;
  onToggleSelectAll: (checked: boolean) => void;
  onToggleSelectOne: (id: string, checked: boolean) => void;
}) {
  if (props.loading) {
    return <p className="py-6 text-sm text-muted-foreground">加载中…</p>;
  }
  if (props.items.length === 0) {
    return <p className="py-6 text-sm text-muted-foreground">{props.emptyText}</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">
            <Checkbox
              checked={props.allSelected}
              onCheckedChange={(checked) => props.onToggleSelectAll(Boolean(checked))}
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
        {props.items.map((session) => (
          <TableRow key={session.id}>
            <TableCell>
              <Checkbox
                checked={props.selectedSet.has(session.id)}
                onCheckedChange={(checked) => props.onToggleSelectOne(session.id, Boolean(checked))}
                aria-label={`选择会话 ${session.title}`}
              />
            </TableCell>
            <TableCell className="max-w-[min(28rem,50vw)] truncate font-medium">{session.title}</TableCell>
            <TableCell className="w-24">{session.is_archived ? '已归档' : '进行中'}</TableCell>
            <TableCell className="hidden w-20 text-muted-foreground sm:table-cell">{session.message_count}</TableCell>
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
  );
}
