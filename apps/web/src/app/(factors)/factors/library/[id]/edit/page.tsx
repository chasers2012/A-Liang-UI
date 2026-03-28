"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getFactor, patchFactor } from "@/lib/quant-agent-api";

import {
  bodyFromForm,
  emptyForm,
  hydrateFromDetail,
  type FactorFormState,
  validateFormForSubmit,
} from "@/features/factors/form-model";
import { FactorFormFields } from "@/features/factors/ui/factor-form-fields";
import { PageFormHeaderActions } from "@/components/page-form-header-actions";
import {
  FACTOR_MAIN_FORM_ID,
  factorFormPageDescription,
  FactorFormLoadError,
  FactorFormLoading,
  FactorFormPageContainer,
} from "@/features/factors/ui/factor-form-page";

export default function EditFactorPage() {
  const params = useParams<{ id: string }>();
  const raw = params.id;
  const id = Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? "");
  const router = useRouter();

  const [form, setForm] = useState<FactorFormState>(emptyForm);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!id) {
      setLoadError("无效的因子 id");
      setLoading(false);
      return;
    }
    setLoadError(null);
    setLoading(true);
    try {
      const detail = await getFactor(id);
      setForm(hydrateFromDetail(detail));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const v = validateFormForSubmit(form);
    if (v) {
      setFormError(v);
      return;
    }
    if (!id) return;
    setSubmitting(true);
    try {
      await patchFactor(id, bodyFromForm(form));
      router.push(`/factors/library/${encodeURIComponent(id)}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <FactorFormPageContainer
        title="编辑因子"
        description={factorFormPageDescription()}
      >
        <FactorFormLoading />
      </FactorFormPageContainer>
    );
  }

  if (loadError) {
    return <FactorFormLoadError message={loadError} />;
  }

  return (
    <FactorFormPageContainer
      title="编辑因子"
      description={factorFormPageDescription({
        factorNameBadge: form.name,
      })}
      action={
        <PageFormHeaderActions
          formId={FACTOR_MAIN_FORM_ID}
          submitting={submitting}
          cancelHref={`/factors/library/${encodeURIComponent(id)}`}
        />
      }
    >
      <form
        id={FACTOR_MAIN_FORM_ID}
        className="flex flex-col gap-6"
        onSubmit={(e) => void onSubmit(e)}
      >
        <FactorFormFields
          form={form}
          setForm={setForm}
          formError={formError}
          idPrefix={`edit-${id.slice(0, 8)}`}
        />
      </form>

      <p className="text-sm text-muted-foreground">
        保存且源码有变更时会自动生成代码快照。{" "}
        <Link
          href={`/factors/library/${encodeURIComponent(id)}/history`}
          className={cn(
            buttonVariants({ variant: "link" }),
            "h-auto p-0 text-foreground underline-offset-4",
          )}
        >
          查看代码与评价历史
        </Link>
      </p>
    </FactorFormPageContainer>
  );
}
