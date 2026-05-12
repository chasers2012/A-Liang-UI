'use client';

import { useMemo } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  datasourcesEditorFormAtom,
  datasourcesEditorFormErrorAtom,
  datasourcesInspectColumnsBusyAtom,
  datasourcesIsEditingAtom,
  datasourcesPluginFormSchemasAtom,
  datasourcesPluginsAtom,
  datasourcesSelectedIdAtom,
  inspectDatasourceColumnsAtom,
} from '@/models/datasource/panel.atom';
import { getDatasourceColumnsConfig } from '@/models/datasource/plugin-form-schemas';

import { UploadPathWidget } from './datasource-form-upload';

import validator from '@rjsf/validator-ajv8';
import { RjsfStyledForm } from '@/components/rjsf-styled-form';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function DatasourceFieldsPanelContent() {
  const [isEditing] = useAtom(datasourcesIsEditingAtom);
  const [selectedId] = useAtom(datasourcesSelectedIdAtom);
  const [form, setForm] = useAtom(datasourcesEditorFormAtom);
  const [plugins] = useAtom(datasourcesPluginsAtom);
  const [formError] = useAtom(datasourcesEditorFormErrorAtom);
  const [inspecting] = useAtom(datasourcesInspectColumnsBusyAtom);
  const inspectDatasourceColumns = useSetAtom(inspectDatasourceColumnsAtom);
  const { fieldsFormSchema, fieldsFormUiSchema } = useAtomValue(datasourcesPluginFormSchemasAtom);

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
      {!fieldsFormSchema && <p className="text-sm text-muted-foreground">当前数据源没有可配置的字段映射。</p>}

      <div className="max-w-xl space-y-3">
        <div className="flex items-center justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void inspectDatasourceColumns()}
            disabled={inspecting}
          >
            {inspecting ? '探测中...' : '探测列名'}
          </Button>
        </div>

        {fieldsFormSchema ? (
          <RjsfStyledForm
            schema={fieldsFormSchema}
            uiSchema={fieldsFormUiSchema}
            validator={validator}
            formData={getDatasourceColumnsConfig(form)}
            widgets={{ file: UploadPathWidget }}
            onChange={(next: { formData?: Record<string, unknown> }) =>
              setForm((f) => ({
                ...f,
                config: {
                  ...f.config,
                  columns: { ...(next.formData ?? {}) },
                },
              }))
            }
            liveValidate={false}
            noHtml5Validate
            readonly={!isEditing}
          />
        ) : null}
      </div>
    </>
  );
}
