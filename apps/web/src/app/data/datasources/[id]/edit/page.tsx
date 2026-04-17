'use client';

import type { FormEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import { Page } from '@/components/page';
import { cn } from '@/lib/utils';
import { getDatasource, listDatasources, listDatasourcePlugins } from '@/api/datasources';
import type { DatasourcePluginPublic, DataSourcePublic } from '@/models/datasource/dto';

import { commitDatasourceForm } from '../../commit-datasource';
import { emptyForm, hydrateFormFromDataSource, type FormState } from '../../form-model';
import { DatasourceForm } from '../../ui/datasource-form';

export default function EditDatasourcePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const raw = params.id;
  const id = Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? '');

  const [form, setForm] = useState<FormState>(emptyForm);
  const [items, setItems] = useState<DataSourcePublic[] | null>(null);
  const [plugins, setPlugins] = useState<DatasourcePluginPublic[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) {
      setLoadError('无效的 id');
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function run() {
      setLoadError(null);
      setLoading(true);
      try {
        const [ds, all, pluginCatalog] = await Promise.all([
          getDatasource(id),
          listDatasources(),
          listDatasourcePlugins(),
        ]);
        if (cancelled) return;
        setItems(all);
        setPlugins(pluginCatalog);
        setForm(hydrateFormFromDataSource(ds));
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const onSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!id) return;
      setFormError(null);
      setSubmitting(true);
      try {
        await commitDatasourceForm('edit', id, form, items);
        router.push(`/data/datasources/${encodeURIComponent(id)}`);
      } catch (err) {
        setFormError(err instanceof Error ? err.message : String(err));
      } finally {
        setSubmitting(false);
      }
    },
    [form, id, items, router],
  );

  if (!id) {
    return (
      <div className="p-6 md:p-8">
        <p className="text-sm text-muted-foreground">无效的 id</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 md:p-8">
        <p className="text-sm text-muted-foreground">加载中…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <Page gap="sm">
        <Alert variant="destructive">
          <AlertTitle>无法加载数据源</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
        <Link href="/data/datasources" className={cn(buttonVariants({ variant: 'outline' }))}>
          返回列表
        </Link>
      </Page>
    );
  }

  return (
    <DatasourceForm
      editorMode="edit"
      form={form}
      setForm={setForm}
      plugins={plugins}
      formError={formError}
      submitting={submitting}
      onSubmit={onSubmit}
      cancelHref={`/data/datasources/${encodeURIComponent(id)}`}
    />
  );
}
