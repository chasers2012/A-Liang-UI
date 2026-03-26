"use client";

import { useCallback, useEffect, useState } from "react";
import { Database, Plus } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ApiError,
  type DataSourcePublic,
  deleteDatasource,
  getQuantAgentApiBase,
  listDatasources,
  patchDatasource,
  testDatasource,
} from "@/lib/quant-agent-api";

import { commitDatasourceForm } from "./commit-datasource";
import {
  emptyForm,
  hydrateFormFromDataSource,
  type EditorMode,
  type FormState,
} from "./form-model";
import { DatasourceEditorDialog } from "./ui/datasource-editor-dialog";
import { DatasourceTable } from "./ui/datasource-table";
import { DeleteDatasourceDialog } from "./ui/delete-datasource-dialog";

export function DatasourcesPanel() {
  const [items, setItems] = useState<DataSourcePublic[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [testHint, setTestHint] = useState<{
    id: string;
    ok: boolean;
    message: string;
  } | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<EditorMode>("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<DataSourcePublic | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);

  const refresh = useCallback(async () => {
    setLoadError(null);
    try {
      setItems(await listDatasources());
    } catch (e) {
      setItems(null);
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openCreate = useCallback(() => {
    setEditorMode("create");
    setEditingId(null);
    setForm(emptyForm());
    setFormError(null);
    setEditorOpen(true);
  }, []);

  const openEdit = useCallback((ds: DataSourcePublic) => {
    setEditorMode("edit");
    setEditingId(ds.id);
    setForm(hydrateFormFromDataSource(ds));
    setFormError(null);
    setEditorOpen(true);
  }, []);

  const onSubmitForm = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setFormError(null);
      setSubmitting(true);
      try {
        const noop = await commitDatasourceForm(
          editorMode,
          editingId,
          form,
          items,
        );
        if (noop) {
          setEditorOpen(false);
          return;
        }
        setEditorOpen(false);
        await refresh();
      } catch (err) {
        setFormError(err instanceof Error ? err.message : String(err));
      } finally {
        setSubmitting(false);
      }
    },
    [editorMode, editingId, form, items, refresh],
  );

  const withBusy = useCallback(
    async (id: string, fn: () => Promise<unknown>) => {
      setBusyId(id);
      setTestHint(null);
      try {
        await fn();
        await refresh();
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusyId(null);
      }
    },
    [refresh],
  );

  const toggleEnabled = (ds: DataSourcePublic, enabled: boolean) =>
    void withBusy(ds.id, () => patchDatasource(ds.id, { enabled }));

  const toggleDefault = (ds: DataSourcePublic, isDefault: boolean) =>
    void withBusy(ds.id, () => patchDatasource(ds.id, { is_default: isDefault }));

  const runTest = async (ds: DataSourcePublic) => {
    setBusyId(ds.id);
    setTestHint(null);
    try {
      const r = await testDatasource(ds.id);
      setTestHint({ id: ds.id, ok: r.ok, message: r.message });
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : String(e);
      setTestHint({ id: ds.id, ok: false, message: msg });
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDatasource(deleteTarget.id);
      setDeleteTarget(null);
      await refresh();
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeleting(false);
    }
  };

  const editingSql = editingId
    ? items?.find((i) => i.id === editingId)?.sql
    : undefined;

  const count = items?.length ?? 0;

  return (
    <div className="mx-auto flex min-h-0 min-w-0 w-full max-w-5xl flex-1 flex-col gap-8 p-6 md:p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            数据源
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            配置经{" "}
            <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">
              {getQuantAgentApiBase()}
            </code>{" "}
            读写，落盘于服务端 workspace（
            <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">
              QUANT_AGENT_WORKSPACE
            </code>
            ，默认{" "}
            <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">
              ~/.quant-agent
            </code>
            ）。
          </p>
        </div>
        <Button type="button" onClick={openCreate} className="shrink-0 gap-1.5">
          <Plus className="size-4" />
          新增数据源
        </Button>
      </header>

      {loadError && (
        <Alert variant="destructive">
          <AlertTitle>无法加载列表</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      {testHint && (
        <Alert variant={testHint.ok ? "default" : "destructive"}>
          <AlertTitle>连接测试</AlertTitle>
          <AlertDescription>{testHint.message}</AlertDescription>
        </Alert>
      )}

      <Card className="border-border/80 shadow-sm">
        <CardHeader className="border-b border-border/60 bg-muted/10 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">已配置的数据源</CardTitle>
              <CardDescription>
                共 {count} 条；可在列表中快速启用、设默认或测试连接。
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {items && items.length === 0 && !loadError && (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/80 bg-muted/5 py-16 text-center">
              <Database
                className="size-12 text-muted-foreground/40"
                strokeWidth={1.25}
              />
              <p className="text-sm text-muted-foreground">
                暂无数据源，点击右上角「新增数据源」开始配置。
              </p>
              <Button type="button" variant="secondary" size="sm" onClick={openCreate}>
                新增数据源
              </Button>
            </div>
          )}
          {items && items.length > 0 && (
            <DatasourceTable
              items={items}
              busyId={busyId}
              onToggleEnabled={toggleEnabled}
              onToggleDefault={toggleDefault}
              onTest={runTest}
              onEdit={openEdit}
              onDelete={setDeleteTarget}
            />
          )}
        </CardContent>
      </Card>

      <DatasourceEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        editorMode={editorMode}
        form={form}
        setForm={setForm}
        editingSql={editingSql ?? undefined}
        formError={formError}
        submitting={submitting}
        onSubmit={onSubmitForm}
      />

      <DeleteDatasourceDialog
        target={deleteTarget}
        deleting={deleting}
        onDismiss={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
