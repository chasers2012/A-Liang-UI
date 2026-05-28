'use client';
/* eslint-disable react-hooks/static-components -- RJSF resolves widgets via getWidget at render time (same pattern as @rjsf/core StringField). */

import { useCallback } from 'react';
import {
  ErrorSchema,
  FieldProps,
  FormContextType,
  getUiOptions,
  getWidget,
  hasWidget,
  optionsList,
  RJSFSchema,
  StrictRJSFSchema,
} from '@rjsf/utils';

/**
 * 与 @rjsf/core StringField 相同，但将 registry.globalUiOptions 传入 getUiOptions，
 * 使 ui:globalOptions.emptyValue 进入 widget options。
 */
export default function RjsfStringField<
  T = unknown,
  S extends StrictRJSFSchema = RJSFSchema,
  F extends FormContextType = object,
>(props: FieldProps<T, S, F>) {
  const {
    schema,
    name,
    uiSchema,
    fieldPathId,
    formData,
    required,
    disabled = false,
    readonly = false,
    autofocus = false,
    onChange,
    onBlur,
    onFocus,
    registry,
    rawErrors,
    hideError,
    title,
  } = props;
  const { title: schemaTitle, format } = schema;
  const { widgets, schemaUtils, globalUiOptions } = registry;
  const enumOptions = schemaUtils.isSelect(schema) ? optionsList<T, S, F>(schema, uiSchema) : undefined;
  let defaultWidget = enumOptions ? 'select' : 'text';
  if (format && hasWidget<T, S, F>(schema, format, widgets)) {
    defaultWidget = format;
  }
  const {
    widget = defaultWidget,
    placeholder = '',
    title: uiTitle,
    ...options
  } = getUiOptions<T, S, F>(uiSchema, globalUiOptions);
  const displayLabel = schemaUtils.getDisplayLabel(schema, uiSchema, globalUiOptions);
  const label = uiTitle ?? title ?? schemaTitle ?? name;
  const Widget = getWidget<T, S, F>(schema, widget, widgets);
  const onWidgetChange = useCallback(
    (value: T | undefined, errorSchema?: ErrorSchema, id?: string) => {
      return onChange(value, fieldPathId.path, errorSchema, id);
    },
    [onChange, fieldPathId],
  );
  return (
    <Widget
      options={{ ...options, enumOptions }}
      schema={schema}
      uiSchema={uiSchema}
      id={fieldPathId.$id}
      name={name}
      label={label}
      hideLabel={!displayLabel}
      hideError={hideError}
      value={formData}
      onChange={onWidgetChange}
      onBlur={onBlur}
      onFocus={onFocus}
      required={required}
      disabled={disabled}
      readonly={readonly}
      autofocus={autofocus}
      registry={registry}
      placeholder={placeholder}
      rawErrors={rawErrors}
      htmlName={fieldPathId.name}
    />
  );
}
