'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { ArchiveRestore, Trash2 } from 'lucide-react';

import { Page } from '@/components/page';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { ChatArchivedSummaryPublic } from '@/models/agent-llm/dto';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  archiveConfirmDeleteAtom,
  archiveDeletingIdAtom,
  archiveErrorAtom,
  archivedSessionsAtom,
  archiveRestoringIdAtom,
  loadArchivedSessionsAtom,
  purgeArchivedSessionAtom,
  restoreArchivedSessionAtom,
} from '@/models/chat/archive';

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

type ArchivedItem = ChatArchivedSummaryPublic;

type ArchivedActionsProps = {
  restoringId: string | null;
  deletingId: string | null;
  onRestore: (id: string) => void;
  onDeleteIntent: (session: ArchivedItem) => void;
};

type ArchivedSessionRowProps = ArchivedActionsProps & {
  session: ArchivedItem;
};

function ArchivedSessionRow({ session, restoringId, deletingId, onRestore, onDeleteIntent }: ArchivedSessionRowProps) {
  return (
    <TableRow>
      <TableCell className="max-w-[min(28rem,50vw)] truncate font-medium">{session.title}</TableCell>
      <TableCell className="hidden text-muted-foreground sm:table-cell">{session.message_count}</TableCell>
      <TableCell className="hidden text-muted-foreground md:table-cell">{formatWhen(session.archived_at)}</TableCell>
      <TableCell className="text-right">
        <div className="inline-flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={restoringId !== null || deletingId !== null}
            onClick={() => onRestore(session.id)}
          >
            <ArchiveRestore className="size-3.5" aria-hidden />
            {restoringId === session.id ? '恢复中…' : '恢复'}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="gap-1.5"
            disabled={restoringId !== null || deletingId !== null}
            onClick={() => onDeleteIntent(session)}
          >
            <Trash2 className="size-3.5" aria-hidden />
            {deletingId === session.id ? '删除中…' : '删除'}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

type ArchivedSessionsTableProps = ArchivedActionsProps & {
  items: ArchivedItem[] | null;
};

function ArchivedSessionsTable({
  items,
  restoringId,
  deletingId,
  onRestore,
  onDeleteIntent,
}: ArchivedSessionsTableProps) {
  if (items === null) {
    return <p className="p-6 text-sm text-muted-foreground">加载中…</p>;
  }

  if (items.length === 0) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        暂无已归档会话。在对话页会话标签栏使用归档按钮即可将当前会话移入此处。
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>标题</TableHead>
          <TableHead className="hidden w-28 sm:table-cell">消息数</TableHead>
          <TableHead className="hidden md:table-cell">归档时间</TableHead>
          <TableHead className="text-right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((session) => (
          <ArchivedSessionRow
            key={session.id}
            session={session}
            restoringId={restoringId}
            deletingId={deletingId}
            onRestore={onRestore}
            onDeleteIntent={onDeleteIntent}
          />
        ))}
      </TableBody>
    </Table>
  );
}

type ArchivedDeleteDialogProps = {
  deletingId: string | null;
  confirmDelete: ArchivedItem | null;
  onClose: () => void;
  onConfirm: (id: string) => void;
};

function ArchivedDeleteDialog({ deletingId, confirmDelete, onClose, onConfirm }: ArchivedDeleteDialogProps) {
  return (
    <ConfirmDialog
      open={confirmDelete !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="删除已归档会话"
      description={
        <div className="space-y-2">
          <p className="text-sm text-foreground">确认永久删除会话「{confirmDelete?.title ?? ''}」？</p>
          <p className="text-sm text-muted-foreground">删除后将无法恢复，历史消息会一并移除。</p>
        </div>
      }
      confirmLabel={deletingId ? '删除中…' : '删除'}
      onConfirm={() => {
        if (!confirmDelete) return;
        onConfirm(confirmDelete.id);
      }}
    />
  );
}

export default function ArchivedChatsPage() {
  const router = useRouter();
  const [items] = useAtom(archivedSessionsAtom);
  const [error] = useAtom(archiveErrorAtom);
  const [restoringId] = useAtom(archiveRestoringIdAtom);
  const [deletingId] = useAtom(archiveDeletingIdAtom);
  const [confirmDelete, setConfirmDelete] = useAtom(archiveConfirmDeleteAtom);

  const loadArchivedSessions = useSetAtom(loadArchivedSessionsAtom);
  const restoreArchivedSession = useSetAtom(restoreArchivedSessionAtom);
  const purgeArchivedSession = useSetAtom(purgeArchivedSessionAtom);

  useEffect(() => {
    void loadArchivedSessions();
  }, [loadArchivedSessions]);

  const onRestore = async (id: string) => {
    const result = await restoreArchivedSession(id);
    if (result.ok) {
      router.push('/');
    }
  };

  const onDelete = async (id: string) => {
    await purgeArchivedSession(id);
  };

  return (
    <Page
      title="已归档会话"
      description={
        <p className="text-sm text-muted-foreground">
          归档后的会话会出现在此列表。恢复后将重新出现在{' '}
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
          <CardTitle>归档列表</CardTitle>
          <CardDescription>按归档时间从新到旧排序。恢复不会丢失历史消息。</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ArchivedSessionsTable
            items={items}
            restoringId={restoringId}
            deletingId={deletingId}
            onRestore={(id) => void onRestore(id)}
            onDeleteIntent={setConfirmDelete}
          />
        </CardContent>
      </Card>

      <ArchivedDeleteDialog
        deletingId={deletingId}
        confirmDelete={confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={(id) => void onDelete(id)}
      />
    </Page>
  );
}
