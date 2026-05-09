'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

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
  onValidityChange?: (valid: boolean) => void;
  /** 编辑已保存的数据源时传入，列探测会与服务端合并密钥（避免仅拿到脱敏后的密码）。 */
  editingDatasourceId?: string | null;
  /** 展示模式：沿用同一套 schema 渲染为只读，不显示向导与探测操作。 */
  readOnly?: boolean;
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

function isValueFilled(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function areRequiredFieldsFilled(schema: Record<string, unknown>, data: Record<string, unknown>): boolean {
  const required = Array.isArray(schema.required) ? schema.required : [];
  if (required.length === 0) return true;
  return required.every((key) => {
    if (typeof key !== 'string' || key.length === 0) return true;
    return isValueFilled(data[key]);
  });
}

function DatasourceFormPluginReadOnly(props: {
  plugin: DatasourcePluginPublic;
  form: FormState;
  baseFormSchema: Record<string, unknown>;
  baseFormUiSchema: Record<string, unknown>;
  fieldsFormSchema: Record<string, unknown> | null;
  fieldsFormUiSchema: Record<string, unknown>;
}) {
  const noopChange = () => {
    /* read-only display */
  };
  const { form, baseFormSchema, baseFormUiSchema, fieldsFormSchema, fieldsFormUiSchema } = props;
  return (
    <div className="max-w-xl space-y-6">
      <div className="space-y-3">
        <div className="text-sm font-medium text-foreground">基础配置</div>
        <RjsfStyledForm
          schema={baseFormSchema}
          uiSchema={baseFormUiSchema}
          validator={validator}
          formData={form.config}
          widgets={{ file: UploadPathWidget }}
          onChange={noopChange}
          liveValidate={false}
          noHtml5Validate
          readonly
        >
          <></>
        </RjsfStyledForm>
      </div>
      {fieldsFormSchema ? (
        <div className="space-y-3">
          <div className="text-sm font-medium text-foreground">字段映射</div>
          <RjsfStyledForm
            schema={fieldsFormSchema}
            uiSchema={fieldsFormUiSchema}
            validator={validator}
            formData={form.config}
            widgets={{ file: UploadPathWidget }}
            onChange={noopChange}
            liveValidate={false}
            noHtml5Validate
            readonly
          >
            <></>
          </RjsfStyledForm>
        </div>
      ) : null}
    </div>
  );
}

function DatasourceFormPluginEditable(props: {
  plugin: DatasourcePluginPublic;
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;
  draftConfigRef: MutableRefObject<Record<string, unknown>>;
  baseFormSchema: Record<string, unknown>;
  baseFormUiSchema: Record<string, unknown>;
  fieldsFormSchema: Record<string, unknown> | null;
  fieldsFormUiSchema: Record<string, unknown>;
  hasFieldsStep: boolean;
  editingDatasourceId: string | null | undefined;
}) {
  const {
    plugin,
    form,
    setForm,
    draftConfigRef,
    baseFormSchema,
    baseFormUiSchema,
    fieldsFormSchema,
    fieldsFormUiSchema,
    hasFieldsStep,
    editingDatasourceId,
  } = props;
  const [activeStep, setActiveStep] = useState(0);
  const [inspecting, setInspecting] = useState(false);
  const [inspectError, setInspectError] = useState<string | null>(null);

  const onInspectColumns = async (): Promise<boolean> => {
    setInspectError(null);
    setInspecting(true);
    try {
      const currentConfig = draftConfigRef.current;
      const resp = await inspectDatasourceColumns({
        ...(editingDatasourceId ? { datasource_id: editingDatasourceId } : { type: plugin.type }),
        config: currentConfig,
      });
      const cols = Array.from(new Set((resp.columns ?? []).map((x) => String(x).trim()).filter((x) => x.length > 0)));
      if (cols.length === 0) {
        throw new Error('连接成功，但未获取到可用列名');
      }
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
      return true;
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : String(err);
      setInspectError(msg);
      return false;
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
    const ok = await onInspectColumns();
    if (ok) {
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
          />
          {hasFieldsStep ? (
            <StepperItem index={1} title="字段映射" description="选择日期列和资产列" active={activeStep === 1} />
          ) : null}
        </Stepper>
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
          <div className="space-y-3">
            <div className="text-sm font-medium text-foreground">字段映射</div>
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

export function DatasourceFormPluginConfig({
  form,
  setForm,
  plugin,
  onValidityChange,
  editingDatasourceId = null,
  readOnly = false,
}: Props) {
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

  const pluginConfigValid = useMemo(() => {
    if (!plugin) return false;
    const baseValid = areRequiredFieldsFilled(baseFormSchema, form.config);
    const fieldsValid = !fieldsFormSchema || areRequiredFieldsFilled(fieldsFormSchema, form.config);
    return baseValid && fieldsValid;
  }, [plugin, baseFormSchema, fieldsFormSchema, form.config]);

  useEffect(() => {
    onValidityChange?.(pluginConfigValid);
  }, [onValidityChange, pluginConfigValid]);

  if (!plugin) return null;

  if (readOnly) {
    return (
      <DatasourceFormPluginReadOnly
        plugin={plugin}
        form={form}
        baseFormSchema={baseFormSchema}
        baseFormUiSchema={baseFormUiSchema}
        fieldsFormSchema={fieldsFormSchema}
        fieldsFormUiSchema={fieldsFormUiSchema}
      />
    );
  }

  return (
    <DatasourceFormPluginEditable
      plugin={plugin}
      form={form}
      setForm={setForm}
      draftConfigRef={draftConfigRef}
      baseFormSchema={baseFormSchema}
      baseFormUiSchema={baseFormUiSchema}
      fieldsFormSchema={fieldsFormSchema}
      fieldsFormUiSchema={fieldsFormUiSchema}
      hasFieldsStep={hasFieldsStep}
      editingDatasourceId={editingDatasourceId}
    />
  );
}
