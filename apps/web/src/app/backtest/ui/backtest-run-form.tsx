'use client';

import { useAtomValue, useSetAtom } from 'jotai';
import type { RJSFSchema, UiSchema } from '@rjsf/utils';
import validator from '@rjsf/validator-ajv8';
import { useEffect } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RjsfStyledForm } from '@/components/rjsf-styled-form';
import {
  backtestRunFormAtom,
  loadBacktestRunSpecAtom,
  setBacktestRunFormDataAtom,
  submitBacktestRunAtom,
} from '@/models/backtest/run.atom';

export function BacktestRunForm({ embedded = false }: { embedded?: boolean }) {
  const { spec, formData, submitting, specLoading, error } = useAtomValue(backtestRunFormAtom);
  const loadSpec = useSetAtom(loadBacktestRunSpecAtom);
  const setFormData = useSetAtom(setBacktestRunFormDataAtom);
  const submit = useSetAtom(submitBacktestRunAtom);

  useEffect(() => {
    void loadSpec();
  }, [loadSpec]);

  const submitDisabled =
    submitting ||
    specLoading ||
    !String(formData?.strategy_id ?? '').trim() ||
    !String(formData?.data_set_id ?? '').trim();

  const formBody = (
    <>
      {error ? (
        <Alert variant="destructive" className="mb-3">
          <AlertTitle>操作失败</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-3">
        <div className="max-w-xl">
          {spec ? (
            <RjsfStyledForm
              schema={(spec.schema ?? {}) as RJSFSchema}
              uiSchema={(spec.uiSchema ?? {}) as UiSchema}
              validator={validator}
              formData={formData}
              onChange={(next) => setFormData((next.formData as Record<string, unknown>) ?? {})}
              liveValidate={false}
              noHtml5Validate
              tabbedByNav
            />
          ) : null}
        </div>

        <div className="flex items-center justify-end">
          <Button type="button" disabled={submitDisabled} onClick={() => void submit()}>
            {submitting ? '提交中…' : '提交'}
          </Button>
        </div>
      </div>
    </>
  );

  if (embedded) return formBody;

  return (
    <Card>
      <CardHeader>
        <CardTitle>发起回测</CardTitle>
      </CardHeader>
      <CardContent>{formBody}</CardContent>
    </Card>
  );
}
