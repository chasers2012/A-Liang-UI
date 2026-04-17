'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { createFactor, getFactorTemplate } from '@/api/factors';

import {
  bodyFromForm,
  defaultNewFactorName,
  emptyForm,
  type FactorFormState,
  validateFormForSubmit,
} from '@/models/factor';
import { FactorEditPageDescription } from '@/app/factors/ui/factor-edit-page-description';
import { FactorEditPageTitle } from '@/app/factors/ui/factor-edit-page-title';
import { applyFactorFormPatch, FactorFormFields } from '@/app/factors/ui/factor-form-fields';
import { PageFormHeaderActions } from '@/components/page-form-header-actions';
import { Page } from '@/components/page';
import { FACTOR_MAIN_FORM_ID, FactorFormLoading } from '@/app/factors/ui/factor-form-page';

export default function NewFactorPage() {
  const router = useRouter();
  const [form, setForm] = useState<FactorFormState>(() => ({
    ...emptyForm(),
    name: '',
  }));
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const source = await getFactorTemplate();
        if (!cancelled) {
          setForm((prev) => ({ ...prev, source }));
          setForm((f) => applyFactorFormPatch(f, { name: defaultNewFactorName() }));
        }
      } catch (e) {
        if (!cancelled) {
          setBootstrapError(e instanceof Error ? e.message : '无法加载默认因子源码模板');
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
      router.push(`/factors/library/${encodeURIComponent(created.id)}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (bootstrapping) {
    return (
      <Page title="新增因子">
        <FactorFormLoading />
      </Page>
    );
  }

  return (
    <Page
      title={
        <FactorEditPageTitle
          name={form.name}
          onNameChange={(next) => setForm((f) => applyFactorFormPatch(f, { name: next }))}
        />
      }
      description={
        <FactorEditPageDescription
          description={form.description}
          onDescriptionChange={(next) => setForm((f) => applyFactorFormPatch(f, { description: next }))}
        />
      }
      action={
        <PageFormHeaderActions formId={FACTOR_MAIN_FORM_ID} submitting={submitting} cancelHref="/factors/library" />
      }
    >
      {bootstrapError ? (
        <Alert variant="destructive" className="mb-2">
          <AlertTitle>默认模板加载失败</AlertTitle>
          <AlertDescription>{bootstrapError}</AlertDescription>
        </Alert>
      ) : null}

      <form id={FACTOR_MAIN_FORM_ID} className="flex flex-col gap-6" onSubmit={(e) => void onSubmit(e)}>
        <FactorFormFields
          form={form}
          setForm={setForm}
          formError={formError}
          idPrefix="new-factor"
          hideNameField
          hideDescriptionField
        />
      </form>
    </Page>
  );
}
