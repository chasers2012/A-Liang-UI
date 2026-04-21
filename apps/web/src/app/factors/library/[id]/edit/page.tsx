'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

import { getFactor, patchFactor } from '@/api/factors';

import {
  bodyFromForm,
  emptyForm,
  hydrateFromDetail,
  type FactorFormState,
  validateFormForSubmit,
} from '@/models/factor';
import { FactorEditPageDescription } from '@/app/factors/ui/factor-edit-page-description';
import { FactorEditPageTitle } from '@/app/factors/ui/factor-edit-page-title';
import { applyFactorFormPatch, FactorFormFields } from '@/app/factors/ui/factor-form-fields';
import { PageFormHeaderActions } from '@/components/page-form-header-actions';
import { Page } from '@/components/page';
import { FACTOR_MAIN_FORM_ID, FactorFormLoadError, FactorFormLoading } from '@/app/factors/ui/factor-form-page';

export default function EditFactorPage() {
  const params = useParams<{ id: string }>();
  const raw = params.id;
  const id = Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? '');
  const router = useRouter();

  const [form, setForm] = useState<FactorFormState>(emptyForm);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!id) {
      setLoadError('无效的因子 id');
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
      <Page title="编辑因子">
        <FactorFormLoading />
      </Page>
    );
  }

  if (loadError) {
    return <FactorFormLoadError message={loadError} />;
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
        <PageFormHeaderActions
          formId={FACTOR_MAIN_FORM_ID}
          submitting={submitting}
          cancelHref={`/factors/library/${encodeURIComponent(id)}`}
        />
      }
    >
      <form id={FACTOR_MAIN_FORM_ID} className="flex flex-col gap-6" onSubmit={(e) => void onSubmit(e)}>
        <FactorFormFields
          form={form}
          setForm={setForm}
          formError={formError}
          idPrefix={`edit-${id.slice(0, 8)}`}
          hideNameField
          hideDescriptionField
        />
      </form>
    </Page>
  );
}
