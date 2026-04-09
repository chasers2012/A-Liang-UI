"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Page } from "@/components/page";
import {
  ApiError,
  getPreprocessor,
  patchPreprocessor,
  type PreprocessorDetailPublic,
} from "@/lib/quant-agent-api";
import { cn } from "@/lib/utils";

import {
  PreprocessorForm,
  type PreprocessorFormState,
} from "../../ui/preprocessor-form";

function hydrate(row: PreprocessorDetailPublic): PreprocessorFormState {
  return {
    name: row.name,
    description: row.description,
    source: row.source,
  };
}

export default function EditPreprocessorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const raw = params.id;
  const id = Array.isArray(raw) ? raw[0] ?? "" : raw ?? "";

  const [form, setForm] = useState<PreprocessorFormState>({
    name: "",
    description: "",
    source: "",
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) {
      setLoadError("无效的 id");
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function run() {
      setLoadError(null);
      setLoading(true);
      try {
        const row = await getPreprocessor(id);
        if (cancelled) return;
        setForm(hydrate(row));
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
  }, [id]);

  const onSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!id) return;
      setFormError(null);
      const description = form.description.trim();
      const source = form.source.trim();
      if (!source) {
        setFormError("source 不能为空");
        return;
      }
      setSubmitting(true);
      try {
        await patchPreprocessor(id, { description, source });
        router.push(`/data/preprocessors/${encodeURIComponent(id)}`);
      } catch (err) {
        const msg =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : String(err);
        setFormError(msg);
      } finally {
        setSubmitting(false);
      }
    },
    [form.description, form.source, id, router],
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
          <AlertTitle>无法加载预处理器</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
        <Link
          href="/data/preprocessors"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          返回列表
        </Link>
      </Page>
    );
  }

  return (
    <PreprocessorForm
      editorMode="edit"
      form={form}
      setForm={setForm}
      formError={formError}
      submitting={submitting}
      onSubmit={onSubmit}
      cancelHref={`/data/preprocessors/${encodeURIComponent(id)}`}
    />
  );
}

