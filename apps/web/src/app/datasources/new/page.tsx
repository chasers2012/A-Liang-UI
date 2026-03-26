"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  listDatasources,
  type DataSourcePublic,
} from "@/lib/quant-agent-api";

import { commitDatasourceForm } from "../commit-datasource";
import { emptyForm, type FormState } from "../form-model";
import { DatasourceForm } from "../ui/datasource-form";

export default function NewDatasourcePage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [items, setItems] = useState<DataSourcePublic[] | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void listDatasources().then(setItems).catch(() => setItems([]));
  }, []);

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
          router.push(`/datasources/${encodeURIComponent(result.id)}`);
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
      editingSql={undefined}
      formError={formError}
      submitting={submitting}
      onSubmit={onSubmit}
      cancelHref="/datasources"
    />
  );
}
