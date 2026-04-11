"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  ApiError,
  createPreprocessor,
  getPreprocessorTemplate,
} from "@/api";
import { defaultNewName } from "@/lib/default-new-name";

import {
  PreprocessorForm,
  type PreprocessorFormState,
} from "../ui/preprocessor-form";

const emptyForm = (): PreprocessorFormState => ({
  name: defaultNewName("新预处理器"),
  description: "",
  source: "",
});

export default function NewPreprocessorPage() {
  const router = useRouter();
  const [form, setForm] = useState<PreprocessorFormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [templateLoading, setTemplateLoading] = useState(true);
  const [templateError, setTemplateError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const template = await getPreprocessorTemplate();
        if (!cancelled) {
          setForm((f) => ({ ...f, source: template }));
        }
      } catch (e) {
        if (!cancelled) {
          setTemplateError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) {
          setTemplateLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setFormError(null);
      const source = form.source.trim();
      if (!source) {
        setFormError("source 不能为空");
        return;
      }
      setSubmitting(true);
      try {
        const created = await createPreprocessor({ source });
        router.push(`/data/preprocessors/${encodeURIComponent(created.id)}`);
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
    [form.source, router],
  );

  return (
    <PreprocessorForm
      editorMode="create"
      form={form}
      setForm={setForm}
      formError={formError}
      submitting={submitting}
      onSubmit={onSubmit}
      cancelHref="/data/preprocessors"
      templateLoading={templateLoading}
      templateError={templateError}
    />
  );
}

