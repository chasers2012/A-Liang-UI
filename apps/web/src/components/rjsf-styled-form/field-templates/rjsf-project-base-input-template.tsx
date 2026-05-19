'use client';

import {
  ariaDescribedByIds,
  BaseInputTemplateProps,
  examplesId,
  FormContextType,
  GenericObjectType,
  getInputProps,
  RJSFSchema,
  StrictRJSFSchema,
} from '@rjsf/utils';
import { SchemaExamples } from '@rjsf/core';
import { ChangeEvent, FocusEvent, MouseEvent, useCallback } from 'react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type RjsfProjectFormContext = Record<string, unknown> & { __rjsfProjectReadonly?: boolean };

export default function RjsfProjectBaseInputTemplate<
  T extends GenericObjectType = GenericObjectType,
  S extends StrictRJSFSchema = RJSFSchema,
  F extends FormContextType = GenericObjectType,
>({
  id,
  htmlName,
  placeholder,
  required,
  readonly,
  disabled,
  type,
  value,
  onChange,
  onChangeOverride,
  onBlur,
  onFocus,
  autofocus,
  options,
  schema,
  rawErrors = [],
  children,
  extraProps,
  className,
  registry,
}: BaseInputTemplateProps<T, S, F>) {
  const { ClearButton } = registry.templates.ButtonTemplates;
  const forcedReadonly = Boolean((registry.formContext as RjsfProjectFormContext | undefined)?.__rjsfProjectReadonly);
  const isReadonly = readonly || forcedReadonly;
  const inputProps = {
    ...extraProps,
    ...getInputProps<T, S, F>(schema, type, options),
  };
  const _onChange = ({ target: { value: v } }: ChangeEvent<HTMLInputElement>) =>
    onChange(v === '' ? options.emptyValue : v);
  const _onBlur = ({ target }: FocusEvent<HTMLInputElement>) => onBlur(id, target && target.value);
  const _onFocus = ({ target }: FocusEvent<HTMLInputElement>) => onFocus(id, target && target.value);
  const _onClear = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onChange(options.emptyValue);
    },
    [onChange, options.emptyValue],
  );

  return (
    <div className="p-0.5">
      <Input
        id={id}
        name={htmlName || id}
        type={type}
        placeholder={placeholder}
        autoFocus={autofocus}
        required={required}
        disabled={disabled}
        readOnly={isReadonly}
        className={cn({ 'border-destructive focus-visible:ring-0': rawErrors.length > 0 }, className)}
        list={schema.examples ? examplesId(id) : undefined}
        {...inputProps}
        value={value || value === 0 ? value : ''}
        onChange={onChangeOverride || _onChange}
        onBlur={_onBlur}
        onFocus={_onFocus}
        aria-describedby={ariaDescribedByIds(id, !!schema.examples)}
      />
      {options.allowClearTextInputs && !isReadonly && !disabled && value ? (
        <ClearButton onClick={_onClear} registry={registry} />
      ) : null}
      {children}
      <SchemaExamples id={id} schema={schema} />
    </div>
  );
}
