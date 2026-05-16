'use client';

import { useMemo } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import validator from '@rjsf/validator-ajv8';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RjsfStyledForm } from '@/components/rjsf-styled-form';
import {
  datasourcesEditorFormAtom,
  datasourcesEditorFormErrorAtom,
  datasourcesIsEditingAtom,
  datasourcesPluginFormSchemasAtom,
  datasourcesPluginsAtom,
  datasourcesSelectedIdAtom,
} from '@/models/datasource/panel.atom';
import { getDatasourceWriteConfig } from '@/models/datasource/plugin-form-schemas';

export function DatasourceWritePanelContent() {
  const [isEditing] = useAtom(datasourcesIsEditingAtom);
  const [selectedId] = useAtom(datasourcesSelectedIdAtom);
  const [form, setForm] = useAtom(datasourcesEditorFormAtom);
  const [plugins] = useAtom(datasourcesPluginsAtom);
  const [formError] = useAtom(datasourcesEditorFormErrorAtom);
  const { writeFormSchema, writeFormUiSchema } = useAtomValue(datasourcesPluginFormSchemasAtom);

  const selectedPlugin = useMemo(() => plugins.find((p) => p.type === form.type) ?? null, [plugins, form.type]);

  if (!isEditing && !selectedId) {
    return null;
  }
  if (!selectedPlugin) {
    return null;
  }

  return (
    <>
      {formError && (
        <Alert variant="destructive">
          <AlertTitle>校验失败</AlertTitle>
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}
      {!writeFormSchema && <p className="text-sm text-muted-foreground">当前数据源类型不支持配置数据写入。</p>}

      <div className="max-w-xl space-y-3">
        {writeFormSchema ? (
          <RjsfStyledForm
            schema={writeFormSchema}
            uiSchema={writeFormUiSchema}
            validator={validator}
            formData={getDatasourceWriteConfig(form)}
            onChange={(next: { formData?: Record<string, unknown> }) =>
              setForm((f) => ({
                ...f,
                config: {
                  ...f.config,
                  write: { ...(next.formData ?? {}) },
                },
              }))
            }
            liveValidate={false}
            noHtml5Validate
            readonly={!isEditing}
          >
            <></>
          </RjsfStyledForm>
        ) : null}
      </div>
    </>
  );
}
