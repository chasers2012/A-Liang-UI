"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  ApiError,
  createPreprocessor,
  getPreprocessorTemplate,
} from "@/lib/quant-agent-api";

import {
  PreprocessorForm,
  type PreprocessorFormState,
} from "../ui/preprocessor-form";

const emptyForm = (): PreprocessorFormState => ({
  name: "",
  description: "",
  source: "",
});

export default function NewPreprocessorPage() {
  const router = useRouter();
  const [form, setForm] = useState<PreprocessorFormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void getPreprocessorTemplate()
      .then((t) => setForm((f) => ({ ...f, source: t })))
      .catch(() => {
        /* ignore */
      });
  }, []);

  const onLoadTemplate = useCallback(() => {
    setFormError(null);
    void getPreprocessorTemplate()
      .then((t) => setForm((f) => ({ ...f, source: t })))
      .catch((e) =>
        setFormError(e instanceof Error ? e.message : String(e)),
      );
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
      onLoadTemplate={onLoadTemplate}
    />
  );
}

