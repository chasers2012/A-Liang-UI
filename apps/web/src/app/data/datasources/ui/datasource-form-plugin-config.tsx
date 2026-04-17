'use client';

import type { Dispatch, SetStateAction } from 'react';

import Form from '@rjsf/shadcn';
import validator from '@rjsf/validator-ajv8';
import type { RJSFSchema, UiSchema, WidgetProps } from '@rjsf/utils';

import { ApiError } from '@/api/client';
import { uploadFile } from '@/api/upload';
import type { DatasourcePluginPublic } from '@/models/datasource/dto';
import { FileUploadInput } from '@/components/ui/file-upload-input';

import type { FormState } from '../form-model';
import { FormSection } from './form-section';

type Props = {
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;
  plugin: DatasourcePluginPublic | null;
};

function toUploadErrorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return '文件上传失败';
}

function UploadPathWidget(props: WidgetProps) {
  const id = props.id;
  const required = Boolean(props.required);
  const disabled = Boolean(props.disabled || props.readonly);
  const accept = typeof props.options?.accept === 'string' ? props.options.accept : '';
  const value = typeof props.value === 'string' ? props.value : null;

  return (
    <FileUploadInput
      id={id}
      value={value}
      required={required}
      disabled={disabled}
      accept={accept || undefined}
      className="grid gap-2"
      onUpload={(picked) => uploadFile(picked).then((resp) => resp.path)}
      onUploadError={toUploadErrorMessage}
      onUploaded={(path) => props.onChange(path)}
    />
  );
}

export function DatasourceFormPluginConfig({ form, setForm, plugin }: Props) {
  const schema = (plugin?.json_schema ?? {}) as unknown as RJSFSchema;
  const uiSchema = (plugin?.ui_schema ?? {}) as unknown as UiSchema;

  if (!plugin) return null;

  return (
    <FormSection title={plugin.title} description={plugin.description ?? undefined}>
      <div className="max-w-xl">
        <Form
          schema={schema}
          uiSchema={uiSchema}
          validator={validator}
          formData={form.config}
          widgets={{ file: UploadPathWidget }}
          onChange={(next) =>
            setForm((f) => ({
              ...f,
              config: (next.formData as Record<string, unknown>) ?? {},
            }))
          }
          liveValidate={false}
          noHtml5Validate
        >
          <></>
        </Form>
      </div>
    </FormSection>
  );
}
