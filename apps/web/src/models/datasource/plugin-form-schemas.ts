import type { DatasourcePluginPublic } from '@/models/datasource/dto';
import type { FormState } from '@/models/datasource/form-model';

function dictLikeOrEmpty(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  return v as Record<string, unknown>;
}

export function getDatasourceConnectionConfig(form: FormState): Record<string, unknown> {
  return dictLikeOrEmpty(dictLikeOrEmpty(form.config).connection);
}

export function getDatasourceColumnsConfig(form: FormState): Record<string, unknown> {
  return dictLikeOrEmpty(dictLikeOrEmpty(form.config).columns);
}

/** Body shape for ``inspect-columns`` and internal merges: ``{ connection, columns }``. */
export function nestDatasourceConfigForApi(form: FormState): Record<string, unknown> {
  return {
    connection: getDatasourceConnectionConfig(form),
    columns: getDatasourceColumnsConfig(form),
  };
}

export type DatasourcePluginFormSchemas = {
  baseFormSchema: Record<string, unknown>;
  baseFormUiSchema: Record<string, unknown>;
  fieldsFormSchema: Record<string, unknown> | null;
  fieldsFormUiSchema: Record<string, unknown>;
};

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

function buildFieldsFormSchemaWithColumnEnums(
  rawColumnsSchema: Record<string, unknown>,
  persistedColumns: string[],
): Record<string, unknown> {
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
  return { ...base, properties };
}

/** 由插件定义 + 当前表单 config 推导 RJSF schema（供派生 atom / 测试复用） */
export function computeDatasourcePluginFormSchemas(
  form: FormState,
  plugin: DatasourcePluginPublic | null,
): DatasourcePluginFormSchemas {
  const connectionSchema = (plugin?.connection_json_schema ?? {}) as Record<string, unknown>;
  const connectionUiSchema = (plugin?.connection_ui_schema ?? {}) as Record<string, unknown>;
  const rawColumnsSchema = (plugin?.columns_json_schema ?? {}) as Record<string, unknown>;
  const rawColumnsUiSchema = (plugin?.columns_ui_schema ?? {}) as Record<string, unknown>;
  const columnsConfig = getDatasourceColumnsConfig(form);
  const hasSplitColumnsConfig = Object.keys(rawColumnsSchema).length > 0;
  const persistedColumns = Array.from(
    new Set(
      (Array.isArray(columnsConfig.columns) ? columnsConfig.columns : [])
        .map((x) => String(x).trim())
        .filter((x) => x.length > 0),
    ),
  );

  const fieldsFormSchema = hasSplitColumnsConfig
    ? buildFieldsFormSchemaWithColumnEnums(rawColumnsSchema, persistedColumns)
    : null;

  return {
    baseFormSchema: connectionSchema,
    baseFormUiSchema: {
      ...connectionUiSchema,
      'ui:submitButtonOptions': { norender: true },
    },
    fieldsFormSchema,
    fieldsFormUiSchema: {
      ...rawColumnsUiSchema,
      'ui:submitButtonOptions': { norender: true },
    },
  };
}

export function computeDatasourcePluginConfigValid(form: FormState, plugin: DatasourcePluginPublic | null): boolean {
  if (!plugin) return false;
  const { baseFormSchema, fieldsFormSchema } = computeDatasourcePluginFormSchemas(form, plugin);
  const baseValid = areRequiredFieldsFilled(baseFormSchema, getDatasourceConnectionConfig(form));
  const fieldsValid = !fieldsFormSchema || areRequiredFieldsFilled(fieldsFormSchema, getDatasourceColumnsConfig(form));
  return baseValid && fieldsValid;
}

export function computeDatasourcePluginBaseConfigValid(
  form: FormState,
  plugin: DatasourcePluginPublic | null,
): boolean {
  if (!plugin) return false;
  const { baseFormSchema } = computeDatasourcePluginFormSchemas(form, plugin);
  return areRequiredFieldsFilled(baseFormSchema, getDatasourceConnectionConfig(form));
}
