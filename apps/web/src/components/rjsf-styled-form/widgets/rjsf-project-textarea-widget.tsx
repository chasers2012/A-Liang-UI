'use client';

import { ChangeEvent, FocusEvent } from 'react';
import {
  ariaDescribedByIds,
  FormContextType,
  GenericObjectType,
  RJSFSchema,
  StrictRJSFSchema,
  WidgetProps,
} from '@rjsf/utils';

import { Textarea } from '@/components/ui/textarea';

type RjsfProjectFormContext = Record<string, unknown> & { __rjsfProjectReadonly?: boolean };

type CustomWidgetProps<
  T extends GenericObjectType = GenericObjectType,
  S extends StrictRJSFSchema = RJSFSchema,
  F extends FormContextType = GenericObjectType,
> = WidgetProps<T, S, F> & {
  options: { emptyValue?: unknown; rows?: number };
};

export default function RjsfProjectTextareaWidget<
  T extends GenericObjectType = GenericObjectType,
  S extends StrictRJSFSchema = RJSFSchema,
  F extends FormContextType = GenericObjectType,
>({
  id,
  htmlName,
  placeholder,
  value,
  required,
  disabled,
  autofocus,
  readonly,
  onBlur,
  onFocus,
  onChange,
  options,
  className,
  formContext,
}: CustomWidgetProps<T, S, F>) {
  const forcedReadonly = Boolean((formContext as RjsfProjectFormContext | undefined)?.__rjsfProjectReadonly);
  const isReadonly = readonly || forcedReadonly;
  const _onChange = ({ target: { value: v } }: ChangeEvent<HTMLTextAreaElement>) =>
    onChange(v === '' ? options.emptyValue : v);
  const _onBlur = ({ target }: FocusEvent<HTMLTextAreaElement>) => onBlur(id, target && target.value);
  const _onFocus = ({ target }: FocusEvent<HTMLTextAreaElement>) => onFocus(id, target && target.value);

  return (
    <div className="flex p-0.5">
      <Textarea
        id={id}
        name={htmlName || id}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={isReadonly}
        value={value ?? ''}
        required={required}
        autoFocus={autofocus}
        rows={options.rows || 5}
        onChange={_onChange}
        onBlur={_onBlur}
        onFocus={_onFocus}
        aria-describedby={ariaDescribedByIds(id)}
        className={className}
      />
    </div>
  );
}
