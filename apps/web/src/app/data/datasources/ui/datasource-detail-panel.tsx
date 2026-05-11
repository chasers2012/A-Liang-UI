'use client';

import type { FormEvent } from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { PanelDetailCard } from '@/components/panel-detail-card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { defaultNewName } from '@/lib/default-new-name';
import { getDatasource, listDatasourcePlugins } from '@/api/datasources';
import type { DatasourcePluginPublic, DataSourcePublic } from '@/models/datasource/dto';

import { commitDatasourceForm } from '../commit-datasource';
import { emptyForm, hydrateFormFromDataSource, type FormState } from '../form-model';
import { DatasourceFormPluginConfig } from './datasource-form-plugin-config';
import { EditablePageTitle } from '@/components/editable-page-title';

type Mode = 'view' | 'create' | 'edit';

// eslint-disable-next-line complexity
export function DatasourceDetailPanel({
  items,
  selectedId,
  mode,
  busyId,
  listError,
  deleteError,
  testHint,
  onModeChange,
  onSelectId,
  onRefreshList,
  onRunTest,
  onDelete,
}: {
  items: DataSourcePublic[] | null;
  selectedId: string | null;
  mode: Mode;
  busyId: string | null;
  listError: string | null;
  deleteError: string | null;
  testHint: { id: string; ok: boolean; message: string } | null;
  onModeChange: (m: Mode) => void;
  onSelectId: (id: string | null) => void;
  onRefreshList: () => void;
  onRunTest: (ds: DataSourcePublic) => void | Promise<void>;
  onDelete: (ds: DataSourcePublic) => void;
}) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [plugins, setPlugins] = useState<DatasourcePluginPublic[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pluginConfigValid, setPluginConfigValid] = useState(false);

  const selectedItem = useMemo(() => {
    if (!selectedId) return null;
    return items?.find((d) => d.id === selectedId) ?? null;
  }, [items, selectedId]);

  useEffect(() => {
    let cancelled = false;
    async function loadCatalog() {
      try {
        const catalog = await listDatasourcePlugins();
        if (cancelled) return;
        setPlugins(catalog);
      } catch {
        if (!cancelled) setPlugins([]);
      }
    }
    void loadCatalog();
    return () => {
      cancelled = true;
    };
  }, []);

  useLayoutEffect(() => {
    if (mode !== 'view' || !selectedItem) return;
    setForm(hydrateFormFromDataSource(selectedItem));
  }, [mode, selectedItem]);

  useEffect(() => {
    if (mode === 'view') {
      setLoadError(null);
      setFormError(null);
      setLoading(false);
      setSubmitting(false);
      return;
    }

    let cancelled = false;
    async function run() {
      setLoadError(null);
      setFormError(null);
      setLoading(true);
      try {
        if (mode === 'create') {
          const nextName = defaultNewName('新数据源');
          setForm({ ...emptyForm(), name: nextName, type: plugins[0]?.type ?? '', config: {} });
          return;
        }
        if (!selectedId) {
          setLoadError('未选择数据源');
          return;
        }
        const ds = await getDatasource(selectedId);
        if (cancelled) return;
        setForm(hydrateFormFromDataSource(ds));
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [mode, selectedId, plugins]);

  const typeItems = useMemo(
    () => Object.fromEntries(plugins.map((p) => [p.type, p.title?.trim() || p.type])),
    [plugins],
  );
  const selectedPlugin = plugins.find((p) => p.type === form.type) ?? null;

  const mainFormValid = !!form.name.trim() && (mode !== 'create' || !!form.type.trim());
  const pluginFormValid = !!selectedPlugin && pluginConfigValid;

  const onSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setFormError(null);
      setSubmitting(true);
      try {
        if (mode === 'create') {
          const result = await commitDatasourceForm('create', null, form, items);
          if (result) {
            onRefreshList();
            onSelectId(result.id);
            onModeChange('view');
          }
          return;
        }
        if (mode === 'edit') {
          if (!selectedId) throw new Error('未选择数据源');
          await commitDatasourceForm('edit', selectedId, form, items);
          onRefreshList();
          onModeChange('view');
        }
      } catch (err) {
        setFormError(err instanceof Error ? err.message : String(err));
      } finally {
        setSubmitting(false);
      }
    },
    [form, items, mode, onModeChange, onRefreshList, onSelectId, selectedId],
  );

  const alerts = (
    <>
      {listError && (
        <Alert variant="destructive">
          <AlertTitle>无法加载列表</AlertTitle>
          <AlertDescription>{listError}</AlertDescription>
        </Alert>
      )}
      {deleteError && (
        <Alert variant="destructive">
          <AlertTitle>删除失败</AlertTitle>
          <AlertDescription>{deleteError}</AlertDescription>
        </Alert>
      )}
      {testHint && (
        <Alert variant={testHint.ok ? 'default' : 'destructive'}>
          <AlertTitle>连接测试</AlertTitle>
          <AlertDescription>{testHint.message}</AlertDescription>
        </Alert>
      )}
    </>
  );

  if (mode === 'view') {
    if (items === null) {
      return (
        <PanelDetailCard title="数据源">
          <div className="flex flex-col gap-4 overflow-auto p-6">
            {alerts}
            <p className="text-sm text-muted-foreground">加载中…</p>
          </div>
        </PanelDetailCard>
      );
    }
    if (!selectedId) {
      return (
        <PanelDetailCard title="数据源">
          <div className="flex flex-col gap-4 overflow-auto p-6">
            {alerts}
            <p className="text-sm text-muted-foreground">从左侧选择一个数据源，或点击「新增数据源」。</p>
          </div>
        </PanelDetailCard>
      );
    }
    if (!selectedItem) {
      return (
        <PanelDetailCard title="数据源">
          <div className="flex flex-col gap-4 overflow-auto p-6">
            {alerts}
            <p className="text-sm text-muted-foreground">未找到该数据源（可能已被删除）。</p>
          </div>
        </PanelDetailCard>
      );
    }

    const isBusy = busyId === selectedItem.id;
    const viewPlugin = plugins.find((p) => p.type === selectedItem.type) ?? null;

    return (
      <PanelDetailCard
        title={
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="min-w-0">
              <EditablePageTitle
                value={form.name}
                onChange={() => {
                  /* 查看模式不允许改名 */
                }}
                showEdit={false}
                inputAriaLabel="数据源显示名称"
                placeholder="数据源"
                editButtonAriaLabel="编辑名称"
              />
            </span>
            <span className="inline-flex shrink-0 rounded-md bg-muted/80 px-2 py-0.5 font-mono text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
              {selectedItem.type}
            </span>
          </div>
        }
        actions={
          <>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={isBusy}
              onClick={() => void onRunTest(selectedItem)}
            >
              测试连接
            </Button>
            <Button type="button" variant="default" size="sm" onClick={() => onModeChange('edit')}>
              编辑
            </Button>
            <Button type="button" variant="destructive" size="sm" onClick={() => onDelete(selectedItem)}>
              删除
            </Button>
          </>
        }
      >
        <div className="min-h-0 flex-1 space-y-4 overflow-auto">
          {alerts}
          <DatasourceFormPluginConfig form={form} setForm={setForm} plugin={viewPlugin} readOnly />
        </div>
      </PanelDetailCard>
    );
  }

  if (loading) {
    return (
      <PanelDetailCard title="数据源">
        <div className="flex flex-col gap-4 overflow-auto p-6">
          {alerts}
          <p className="text-sm text-muted-foreground">加载中…</p>
        </div>
      </PanelDetailCard>
    );
  }

  if (loadError) {
    return (
      <PanelDetailCard title="数据源">
        <div className="overflow-auto p-6">
          <div className="mb-4">{alerts}</div>
          <Alert variant="destructive">
            <AlertTitle>无法加载数据源</AlertTitle>
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        </div>
      </PanelDetailCard>
    );
  }

  return (
    <PanelDetailCard
      title={
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="min-w-0">
            <EditablePageTitle
              value={form.name}
              onChange={(n) => setForm((f) => ({ ...f, name: n }))}
              inputAriaLabel="数据源显示名称"
              editButtonAriaLabel="编辑名称"
              placeholder={mode === 'create' ? '新数据源' : '数据源'}
            />
          </span>
          {form.type.trim() ? (
            <span className="inline-flex shrink-0 rounded-md bg-muted/80 px-2 py-0.5 font-mono text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
              {form.type}
            </span>
          ) : null}
        </div>
      }
      actions={
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={submitting}
            onClick={() => {
              setFormError(null);
              onModeChange('view');
            }}
          >
            取消
          </Button>
          <Button
            type="submit"
            size="sm"
            form="datasource-panel-form"
            disabled={submitting || !mainFormValid || !pluginFormValid}
          >
            {submitting ? '保存中…' : '保存'}
          </Button>
        </>
      }
    >
      <div className="min-h-0 flex-1 space-y-4 overflow-auto">
        {alerts}
        <form id="datasource-panel-form" className="flex flex-col gap-6" onSubmit={(e) => void onSubmit(e)}>
          {mode === 'create' && (
            <div className="grid gap-2">
              <Label htmlFor="ds-type">类型</Label>
              <Select
                modal={false}
                items={typeItems}
                value={form.type}
                onValueChange={(v) => {
                  if (v == null || v === '') return;
                  setForm((f) => ({ ...f, type: v, config: {} }));
                }}
              >
                <SelectTrigger id="ds-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {plugins.map((p) => (
                    <SelectItem key={p.type} value={p.type}>
                      {p.title?.trim() || p.type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <DatasourceFormPluginConfig
            form={form}
            setForm={setForm}
            plugin={selectedPlugin}
            onValidityChange={setPluginConfigValid}
            editingDatasourceId={mode === 'edit' ? selectedId : null}
          />

          {formError && (
            <Alert variant="destructive">
              <AlertTitle>校验失败</AlertTitle>
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}
        </form>
      </div>
    </PanelDetailCard>
  );
}
