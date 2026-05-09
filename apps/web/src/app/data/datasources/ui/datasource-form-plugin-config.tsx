'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import validator from '@rjsf/validator-ajv8';

import { ApiError } from '@/api/client';
import { inspectDatasourceColumns } from '@/api/datasources';
import { uploadFile } from '@/api/upload';
import type { DatasourcePluginPublic } from '@/models/datasource/dto';
import { RjsfStyledForm } from '@/components/rjsf-styled-form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FileUploadInput } from '@/components/ui/file-upload-input';
import { Stepper, StepperItem } from '@/components/reui/stepper';

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

function UploadPathWidget(props: {
  id: string;
  required?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  value?: unknown;
  options?: Record<string, unknown>;
  onChange: (value: string) => void;
}) {
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
  const [activeStep, setActiveStep] = useState(0);
  const [inspecting, setInspecting] = useState(false);
  const [inspectError, setInspectError] = useState<string | null>(null);
  const [inspectOkMessage, setInspectOkMessage] = useState<string | null>(null);

  const connectionSchema = useMemo(
    () => (plugin?.connection_json_schema ?? {}) as Record<string, unknown>,
    [plugin?.connection_json_schema],
  );
  const connectionUiSchema = useMemo(
    () => (plugin?.connection_ui_schema ?? {}) as Record<string, unknown>,
    [plugin?.connection_ui_schema],
  );
  const rawColumnsSchema = useMemo(
    () => (plugin?.columns_json_schema ?? {}) as Record<string, unknown>,
    [plugin?.columns_json_schema],
  );
  const rawColumnsUiSchema = useMemo(
    () => (plugin?.columns_ui_schema ?? {}) as Record<string, unknown>,
    [plugin?.columns_ui_schema],
  );
  const hasSplitColumnsConfig = Object.keys(rawColumnsSchema).length > 0;
  const persistedColumns = useMemo(
    () =>
      Array.from(
        new Set(
          (Array.isArray(form.config.columns) ? form.config.columns : [])
            .map((x) => String(x).trim())
            .filter((x) => x.length > 0),
        ),
      ),
    [form.config.columns],
  );
  const draftConfigRef = useRef<Record<string, unknown>>(form.config);

  useEffect(() => {
    draftConfigRef.current = form.config;
  }, [form.config]);

  const fieldsFormSchema = useMemo<Record<string, unknown> | null>(() => {
    if (!hasSplitColumnsConfig) return null;
    const base = { ...rawColumnsSchema };
    const properties = {
      ...((base.properties as Record<string, unknown> | undefined) ?? {}),
    };
    if (persistedColumns.length > 0) {
      if (properties.date_column && typeof properties.date_column === 'object') {
        properties.date_column = {
          ...(properties.date_column as Record<string, unknown>),
          enum: persistedColumns,
        };
      }
      if (properties.asset_column && typeof properties.asset_column === 'object') {
        properties.asset_column = {
          ...(properties.asset_column as Record<string, unknown>),
          enum: persistedColumns,
        };
      }
    }
    return {
      ...base,
      properties,
    };
  }, [hasSplitColumnsConfig, persistedColumns, rawColumnsSchema]);
  const hasFieldsStep = Boolean(fieldsFormSchema);
  const baseFormSchema = connectionSchema;
  const baseFormUiSchema = connectionUiSchema;
  const fieldsFormUiSchema = rawColumnsUiSchema;

  if (!plugin) return null;

  const onInspectColumns = async () => {
    setInspectError(null);
    setInspectOkMessage(null);
    setInspecting(true);
    try {
      const currentConfig = draftConfigRef.current;
      const resp = await inspectDatasourceColumns({
        type: plugin.type,
        config: currentConfig,
      });
      const cols = Array.from(new Set((resp.columns ?? []).map((x) => String(x).trim()).filter((x) => x.length > 0)));
      if (cols.length === 0) {
        throw new Error('连接成功，但未获取到可用列名');
      }
      setInspectOkMessage('连接测试成功');
      setForm((f) => {
        const nextConfig = {
          ...currentConfig,
          columns: cols,
          date_column: resp.date_column,
          asset_column: resp.asset_column,
        };
        draftConfigRef.current = nextConfig;
        return {
          ...f,
          config: nextConfig,
        };
      });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : String(err);
      setInspectError(msg);
    } finally {
      setInspecting(false);
    }
  };

  const handleNextStep = async () => {
    if (activeStep === 1) return;
    if (!hasFieldsStep) {
      setActiveStep(1);
      return;
    }
    await onInspectColumns();
    if ((draftConfigRef.current.columns as unknown[] | undefined)?.length) {
      setActiveStep(1);
    }
  };

  return (
    <FormSection title={plugin.title} description={plugin.description ?? undefined}>
      <div className="max-w-xl space-y-3">
        <Stepper>
          <StepperItem
            index={0}
            title="基础配置"
            description="连接参数与列名探测"
            active={activeStep === 0}
            completed={activeStep > 0}
            onClick={() => setActiveStep(0)}
          />
          {hasFieldsStep ? (
            <StepperItem
              index={1}
              title="字段映射"
              description="选择日期列和资产列"
              active={activeStep === 1}
              onClick={() => setActiveStep(1)}
            />
          ) : null}
        </Stepper>
        {inspectOkMessage ? (
          <Alert>
            <AlertDescription>{inspectOkMessage}</AlertDescription>
          </Alert>
        ) : null}
        {inspectError ? (
          <Alert variant="destructive">
            <AlertDescription>{inspectError}</AlertDescription>
          </Alert>
        ) : null}
        {activeStep === 0 ? (
          <RjsfStyledForm
            schema={baseFormSchema}
            uiSchema={baseFormUiSchema}
            validator={validator}
            formData={form.config}
            widgets={{ file: UploadPathWidget }}
            onChange={(next: { formData?: Record<string, unknown> }) =>
              setForm((f) => ({
                ...f,
                config: (() => {
                  const cfg = { ...f.config, ...(next.formData ?? {}) };
                  draftConfigRef.current = cfg;
                  return cfg;
                })(),
              }))
            }
            liveValidate={false}
            noHtml5Validate
          >
            <></>
          </RjsfStyledForm>
        ) : null}
        {activeStep === 1 && fieldsFormSchema ? (
          <div className="rounded-md border border-border/60 p-3">
            <div className="mb-2 text-xs text-muted-foreground">字段映射</div>
            <RjsfStyledForm
              schema={fieldsFormSchema}
              uiSchema={fieldsFormUiSchema}
              validator={validator}
              formData={form.config}
              widgets={{ file: UploadPathWidget }}
              onChange={(next: { formData?: Record<string, unknown> }) =>
                setForm((f) => ({
                  ...f,
                  config: (() => {
                    const cfg = { ...f.config, ...(next.formData ?? {}) };
                    draftConfigRef.current = cfg;
                    return cfg;
                  })(),
                }))
              }
              liveValidate={false}
              noHtml5Validate
            >
              <></>
            </RjsfStyledForm>
          </div>
        ) : null}
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setActiveStep(0)}
            disabled={activeStep === 0}
          >
            上一步
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleNextStep()}
            disabled={activeStep === 1 || inspecting}
          >
            {inspecting ? '连接中...' : '下一步'}
          </Button>
        </div>
      </div>
    </FormSection>
  );
}
