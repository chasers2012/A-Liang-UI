"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  listDatasources,
  listDatasourcePlugins,
  type DatasourcePluginPublic,
  type DataSourcePublic,
} from "@/api";
import { defaultNewName } from "@/lib/default-new-name";

import { commitDatasourceForm } from "../commit-datasource";
import { emptyForm, type FormState } from "../form-model";
import { DatasourceForm } from "../ui/datasource-form";

export default function NewDatasourcePage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => ({
    ...emptyForm(),
    name: defaultNewName("新数据源"),
  }));
  const [items, setItems] = useState<DataSourcePublic[] | null>(null);
  const [plugins, setPlugins] = useState<DatasourcePluginPublic[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void listDatasources().then(setItems).catch(() => setItems([]));
    void listDatasourcePlugins().then(setPlugins).catch(() => setPlugins([]));
  }, []);

  useEffect(() => {
    if (plugins.length === 0) return;
    setForm((f) => (f.type.trim() ? f : { ...f, type: plugins[0].type }));
  }, [plugins]);

  const onSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setFormError(null);
      setSubmitting(true);
      try {
        const result = await commitDatasourceForm(
          "create",
          null,
          form,
          items,
        );
        if (result) {
          router.push(`/data/datasources/${encodeURIComponent(result.id)}`);
        }
      } catch (err) {
        setFormError(err instanceof Error ? err.message : String(err));
      } finally {
        setSubmitting(false);
      }
    },
    [form, items, router],
  );

  return (
    <DatasourceForm
      editorMode="create"
      form={form}
      setForm={setForm}
      plugins={plugins}
      formError={formError}
      submitting={submitting}
      onSubmit={onSubmit}
      cancelHref="/data/datasources"
    />
  );
}
