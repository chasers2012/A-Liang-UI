"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  createFactor,
} from "@/lib/quant-agent-api";

import {
  bodyFromForm,
  emptyForm,
  type FactorFormState,
  validateFormForSubmit,
} from "../form-model";
import { FactorFormFields } from "../ui/factor-form-fields";
import {
  FactorFormHintAlert,
  FactorFormPageContainer,
  FactorFormPageHeader,
  FactorFormSubmitRow,
} from "../ui/factor-form-page";

export default function NewFactorPage() {
  const router = useRouter();
  const [form, setForm] = useState<FactorFormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

  return (
    <FactorFormPageContainer>
      <FactorFormPageHeader title="新增因子" />

      <FactorFormHintAlert>
        保存成功后将进入该因子的详情页。因子文件名为{" "}
        <span className="font-mono text-xs">factors/&lt;uuid&gt;.py</span>
        ，标识 <span className="font-mono text-xs">name</span>{" "}
        写入注册表并与类属性同步。
      </FactorFormHintAlert>

      <form className="flex flex-col gap-6" onSubmit={(e) => void onSubmit(e)}>
        <FactorFormFields
          form={form}
          setForm={setForm}
          formError={formError}
          idPrefix="new-factor"
        />
        <FactorFormSubmitRow submitting={submitting} />
      </form>
    </FactorFormPageContainer>
  );
}
