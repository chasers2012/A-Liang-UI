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

export function getDatasourceWriteConfig(form: FormState): Record<string, unknown> {
  return dictLikeOrEmpty(dictLikeOrEmpty(form.config).write);
}

/** Body shape for ``inspect-columns`` and internal merges: ``{ connection, columns[, write] }``. */
export function nestDatasourceConfigForApi(form: FormState): Record<string, unknown> {
  const nested: Record<string, unknown> = {
    connection: getDatasourceConnectionConfig(form),
    columns: getDatasourceColumnsConfig(form),
  };
  const write = getDatasourceWriteConfig(form);
  if (Object.keys(write).length > 0) {
    nested.write = write;
  }
  return nested;
}

export function pluginHasWriteSchema(plugin: DatasourcePluginPublic | null): boolean {
  const schema = plugin?.write_json_schema;
  if (!schema || typeof schema !== 'object') return false;
  const props = (schema as Record<string, unknown>).properties;
  return props != null && typeof props === 'object' && Object.keys(props as object).length > 0;
}

export type DatasourcePluginFormSchemas = {
  baseFormSchema: Record<string, unknown>;
  baseFormUiSchema: Record<string, unknown>;
  fieldsFormSchema: Record<string, unknown> | null;
  fieldsFormUiSchema: Record<string, unknown>;
  writeFormSchema: Record<string, unknown> | null;
  writeFormUiSchema: Record<string, unknown>;
};

function isValueFilled(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/** Matches API ``FormSchema.is_unchanged_secret_value`` (empty / redacted placeholder). */
function isUnchangedSecretValue(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length === 0 || trimmed === '***';
  }
  return false;
}

function passwordKeysFromUiSchema(ui: Record<string, unknown>): Set<string> {
  const keys = new Set<string>();
  for (const [k, v] of Object.entries(ui)) {
    if (k.startsWith('ui:')) continue;
    if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
    if ((v as Record<string, unknown>)['ui:widget'] === 'password') {
      keys.add(k);
    }
  }
  return keys;
}

type RequiredFieldsFilledOptions = {
  isEdit?: boolean;
  passwordKeys?: Set<string>;
};

function areRequiredFieldsFilled(
  schema: Record<string, unknown>,
  data: Record<string, unknown>,
  options?: RequiredFieldsFilledOptions,
): boolean {
  const required = Array.isArray(schema.required) ? schema.required : [];
  if (required.length === 0) return true;
  const isEdit = options?.isEdit ?? false;
  const passwordKeys = options?.passwordKeys ?? new Set<string>();
  return required.every((key) => {
    if (typeof key !== 'string' || key.length === 0) return true;
    const value = data[key];
    if (isEdit && passwordKeys.has(key) && isUnchangedSecretValue(value)) return true;
    return isValueFilled(value);
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

function persistedColumnNames(columnsConfig: Record<string, unknown>): string[] {
  return Array.from(
    new Set(
      (Array.isArray(columnsConfig.columns) ? columnsConfig.columns : [])
        .map((x) => String(x).trim())
        .filter((x) => x.length > 0),
    ),
  );
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
  const persistedColumns = persistedColumnNames(columnsConfig);

  const fieldsFormSchema = hasSplitColumnsConfig
    ? buildFieldsFormSchemaWithColumnEnums(rawColumnsSchema, persistedColumns)
    : null;

  const rawWriteSchema = (plugin?.write_json_schema ?? {}) as Record<string, unknown>;
  const rawWriteUiSchema = (plugin?.write_ui_schema ?? {}) as Record<string, unknown>;
  const hasWriteConfig = pluginHasWriteSchema(plugin);
  const writeFormSchema = hasWriteConfig ? rawWriteSchema : null;

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
    writeFormSchema,
    writeFormUiSchema: {
      ...rawWriteUiSchema,
      'ui:submitButtonOptions': { norender: true },
    },
  };
}

export type DatasourcePluginConfigValidOptions = {
  /** True when editing an existing datasource (not create). */
  isEdit?: boolean;
};

export function computeDatasourcePluginBaseConfigValid(
  form: FormState,
  plugin: DatasourcePluginPublic | null,
  options?: DatasourcePluginConfigValidOptions,
): boolean {
  if (!plugin) return false;
  const schemas = computeDatasourcePluginFormSchemas(form, plugin);
  return areRequiredFieldsFilled(schemas.baseFormSchema, getDatasourceConnectionConfig(form), {
    isEdit: options?.isEdit ?? false,
    passwordKeys: passwordKeysFromUiSchema(schemas.baseFormUiSchema),
  });
}

export function computeDatasourcePluginConfigValid(
  form: FormState,
  plugin: DatasourcePluginPublic | null,
  options?: DatasourcePluginConfigValidOptions,
): boolean {
  if (!plugin) return false;
  if (!computeDatasourcePluginBaseConfigValid(form, plugin, options)) return false;
  const isEdit = options?.isEdit ?? false;
  const schemas = computeDatasourcePluginFormSchemas(form, plugin);
  const fieldsValid =
    !schemas.fieldsFormSchema ||
    areRequiredFieldsFilled(schemas.fieldsFormSchema, getDatasourceColumnsConfig(form), {
      isEdit,
      passwordKeys: passwordKeysFromUiSchema(schemas.fieldsFormUiSchema),
    });
  const writeValid =
    !schemas.writeFormSchema ||
    areRequiredFieldsFilled(schemas.writeFormSchema, getDatasourceWriteConfig(form), {
      isEdit,
      passwordKeys: passwordKeysFromUiSchema(schemas.writeFormUiSchema),
    });
  return fieldsValid && writeValid;
}
