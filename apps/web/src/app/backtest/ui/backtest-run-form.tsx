'use client';

import { useAtomValue, useSetAtom } from 'jotai';
import type { RJSFSchema, UiSchema } from '@rjsf/utils';
import validator from '@rjsf/validator-ajv8';
import { useEffect } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RjsfStyledForm } from '@/components/rjsf-styled-form';
import { backtestRunFormAtom, loadBacktestRunSpecAtom, setBacktestRunFormDataAtom } from '@/models/backtest/run.atom';

export function BacktestRunForm() {
  const { spec, formData, error } = useAtomValue(backtestRunFormAtom);
  const loadSpec = useSetAtom(loadBacktestRunSpecAtom);
  const setFormData = useSetAtom(setBacktestRunFormDataAtom);

  useEffect(() => {
    void loadSpec();
  }, [loadSpec]);

  return (
    <>
      {error ? (
        <Alert variant="destructive" className="mb-3">
          <AlertTitle>操作失败</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

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
    </>
  );
}
