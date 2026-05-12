'use client';

import { useMemo } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import validator from '@rjsf/validator-ajv8';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  datasourcesEditorFormAtom,
  datasourcesEditorFormErrorAtom,
  datasourcesIsEditingAtom,
  datasourcesPluginFormSchemasAtom,
  datasourcesPluginsAtom,
  datasourcesSelectedIdAtom,
} from '@/models/datasource/panel.atom';
import { RjsfStyledForm } from '@/components/rjsf-styled-form';
import { UploadPathWidget } from './datasource-form-upload';

export function DatasourceBasePanelContent() {
  const [isEditing] = useAtom(datasourcesIsEditingAtom);
  const [selectedId] = useAtom(datasourcesSelectedIdAtom);
  const [form, setForm] = useAtom(datasourcesEditorFormAtom);
  const [plugins] = useAtom(datasourcesPluginsAtom);
  const [formError] = useAtom(datasourcesEditorFormErrorAtom);
  const { baseFormSchema, baseFormUiSchema } = useAtomValue(datasourcesPluginFormSchemasAtom);

  const typeItems = useMemo(
    () => Object.fromEntries(plugins.map((p) => [p.type, p.title?.trim() || p.type])),
    [plugins],
  );

  if (!isEditing && !selectedId) {
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
      <div className="flex flex-col gap-6">
        <div className="max-w-xl space-y-3">
          <div className="grid gap-2">
            <Label htmlFor="ds-type">类型</Label>
            <Select
              modal={false}
              items={typeItems}
              value={form.type}
              disabled={!!selectedId}
              onValueChange={(v) => {
                if (v == null || v === '') return;
                setForm((f) => ({ ...f, type: v, config: {} }));
              }}
            >
              <SelectTrigger id="ds-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {plugins.map((p) => (
                  <SelectItem key={p.type} value={p.type}>
                    {p.title?.trim() || p.type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <RjsfStyledForm
            schema={baseFormSchema}
            uiSchema={baseFormUiSchema}
            validator={validator}
            formData={form.config}
            widgets={{ file: UploadPathWidget }}
            onChange={(next: { formData?: Record<string, unknown> }) =>
              setForm((f) => ({
                ...f,
                config: { ...f.config, ...(next.formData ?? {}) },
              }))
            }
            liveValidate={false}
            noHtml5Validate
            readonly={!isEditing}
          >
            <></>
          </RjsfStyledForm>
        </div>
      </div>
    </>
  );
}
