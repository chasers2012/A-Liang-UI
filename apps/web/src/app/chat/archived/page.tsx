"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useSetAtom } from "jotai";
import { ArchiveRestore, Trash2 } from "lucide-react";

import { Page } from "@/components/page";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ApiError,
  listArchivedAgentChatSessions,
  purgeArchivedAgentChatSession,
  restoreAgentChatSession,
} from "@/lib/quant-agent-api";
import type { AgentChatSessionArchivedSummaryPublic } from "@/models";
import {
  refetchChatSessionsListAtom,
  selectChatSessionAtom,
} from "@/models/chat/session.atom";

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export default function ArchivedChatSessionsPage() {
  const router = useRouter();
  const refetchList = useSetAtom(refetchChatSessionsListAtom);
  const selectSession = useSetAtom(selectChatSessionAtom);
  const [items, setItems] = useState<
    AgentChatSessionArchivedSummaryPublic[] | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<
    AgentChatSessionArchivedSummaryPublic | null
  >(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const list = await listArchivedAgentChatSessions();
      setItems(list);
    } catch (e) {
      setItems([]);
      setError(
        e instanceof ApiError ? e.message : "加载已归档会话失败，请检查网络与 API。",
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onRestore = async (id: string) => {
    setRestoringId(id);
    setError(null);
    try {
      await restoreAgentChatSession(id);
      await refetchList();
      await selectSession(id);
      setItems((prev) => (prev ? prev.filter((s) => s.id !== id) : prev));
      router.push("/");
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "恢复会话失败，请稍后重试。",
      );
    } finally {
      setRestoringId(null);
    }
  };

  const onDelete = async (id: string) => {
    setDeletingId(id);
    setError(null);
    try {
      await purgeArchivedAgentChatSession(id);
      setItems((prev) => (prev ? prev.filter((s) => s.id !== id) : prev));
      setConfirmDelete(null);
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "删除会话失败，请稍后重试。",
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Page
      title="已归档会话"
      description={
        <p className="text-sm text-muted-foreground">
          归档后的会话会出现在此列表。恢复后将重新出现在{" "}
          <Link href="/" className="font-medium text-primary underline-offset-4 hover:underline">
            对话
          </Link>{" "}
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
          <CardDescription>
            按归档时间从新到旧排序。恢复不会丢失历史消息。
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {items === null ? (
            <p className="p-6 text-sm text-muted-foreground">加载中…</p>
          ) : items.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              暂无已归档会话。在对话页会话标签栏使用归档按钮即可将当前会话移入此处。
            </p>
          ) : (
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
                {items.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="max-w-[min(28rem,50vw)] truncate font-medium">
                      {s.title}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {s.message_count}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {formatWhen(s.archived_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          disabled={restoringId !== null || deletingId !== null}
                          onClick={() => void onRestore(s.id)}
                        >
                          <ArchiveRestore className="size-3.5" aria-hidden />
                          {restoringId === s.id ? "恢复中…" : "恢复"}
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="gap-1.5"
                          disabled={restoringId !== null || deletingId !== null}
                          onClick={() => setConfirmDelete(s)}
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                          {deletingId === s.id ? "删除中…" : "删除"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDelete(null);
        }}
        title="删除已归档会话"
        description={
          <div className="space-y-2">
            <p className="text-sm text-foreground">
              确认永久删除会话「{confirmDelete?.title ?? ""}」？
            </p>
            <p className="text-sm text-muted-foreground">
              删除后将无法恢复，历史消息会一并移除。
            </p>
          </div>
        }
        confirmLabel={deletingId ? "删除中…" : "删除"}
        onConfirm={() => {
          if (!confirmDelete) return;
          void onDelete(confirmDelete.id);
        }}
      />
    </Page>
  );
}
