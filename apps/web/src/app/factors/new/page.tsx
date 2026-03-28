"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { createFactor, getFactorDefaultSource } from "@/lib/quant-agent-api";

import {
  bodyFromForm,
  emptyForm,
  type FactorFormState,
  validateFormForSubmit,
} from "../form-model";
import { FactorFormFields } from "../ui/factor-form-fields";
import { PageFormHeaderActions } from "@/components/page-form-header-actions";
import {
  FACTOR_MAIN_FORM_ID,
  factorFormPageDescription,
  FactorFormHintAlert,
  FactorFormPageContainer,
  FactorFormLoading,
} from "../ui/factor-form-page";

export default function NewFactorPage() {
  const router = useRouter();
  const [form, setForm] = useState<FactorFormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { source } = await getFactorDefaultSource("my_factor");
        if (!cancelled) {
          setForm((prev) => ({ ...prev, source }));
        }
      } catch (e) {
        if (!cancelled) {
          setBootstrapError(
            e instanceof Error ? e.message : "无法加载默认因子源码模板",
          );
        }
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const v = validateFormForSubmit(form);
    if (v) {
      setFormError(v);
      return;
    }
    setSubmitting(true);
    try {
      const created = await createFactor(bodyFromForm(form));
      router.push(`/factors/${encodeURIComponent(created.id)}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (bootstrapping) {
    return (
      <FactorFormPageContainer
        title="新增因子"
        description={factorFormPageDescription()}
      >
        <FactorFormLoading />
      </FactorFormPageContainer>
    );
  }

  return (
    <FactorFormPageContainer
      title="新增因子"
      description={factorFormPageDescription()}
      action={
        <PageFormHeaderActions
          formId={FACTOR_MAIN_FORM_ID}
          submitting={submitting}
          cancelHref="/factors"
        />
      }
    >
      {bootstrapError ? (
        <Alert variant="destructive" className="mb-2">
          <AlertTitle>默认模板加载失败</AlertTitle>
          <AlertDescription>{bootstrapError}</AlertDescription>
        </Alert>
      ) : null}

      <FactorFormHintAlert>
        保存成功后将进入该因子的详情页。因子文件名为{" "}
        <span className="font-mono text-xs">factors/&lt;uuid&gt;.py</span>
        ，标识 <span className="font-mono text-xs">name</span>{" "}
        写入注册表并与类属性同步。
      </FactorFormHintAlert>

      <form
        id={FACTOR_MAIN_FORM_ID}
        className="flex flex-col gap-6"
        onSubmit={(e) => void onSubmit(e)}
      >
        <FactorFormFields
          form={form}
          setForm={setForm}
          formError={formError}
          idPrefix="new-factor"
        />
      </form>
    </FactorFormPageContainer>
  );
}
