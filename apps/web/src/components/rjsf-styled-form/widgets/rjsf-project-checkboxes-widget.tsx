'use client';

import {
  ariaDescribedByIds,
  enumOptionsDeselectValue,
  enumOptionsIsSelected,
  enumOptionsSelectValue,
  enumOptionsValueForIndex,
  FormContextType,
  GenericObjectType,
  optionId,
  RJSFSchema,
  StrictRJSFSchema,
  WidgetProps,
} from '@rjsf/utils';
import { FocusEvent } from 'react';

import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { cn } from '@/lib/utils';

type RjsfProjectFormContext = Record<string, unknown> & { __rjsfProjectReadonly?: boolean };

export default function RjsfProjectCheckboxesWidget<
  T extends GenericObjectType = GenericObjectType,
  S extends StrictRJSFSchema = RJSFSchema,
  F extends FormContextType = GenericObjectType,
>({
  id,
  htmlName,
  disabled,
  options,
  value,
  autofocus,
  readonly,
  required,
  onChange,
  onBlur,
  onFocus,
  className,
  formContext,
}: WidgetProps<T, S, F>) {
  const forcedReadonly = Boolean((formContext as RjsfProjectFormContext | undefined)?.__rjsfProjectReadonly);
  const isReadonly = readonly || forcedReadonly;
  const { enumOptions, enumDisabled, inline, emptyValue } = options;
  const checkboxesValues = Array.isArray(value) ? value : [value];

  const _onBlur = (e: FocusEvent<Element>) => {
    const target = e.target as HTMLButtonElement & { value?: string };
    onBlur(id, enumOptionsValueForIndex<S>(target && target.value, enumOptions, emptyValue));
  };
  const _onFocus = (e: FocusEvent<Element>) => {
    const target = e.target as HTMLButtonElement & { value?: string };
    onFocus(id, enumOptionsValueForIndex<S>(target && target.value, enumOptions, emptyValue));
  };

  return (
    <FieldGroup
      data-slot="checkbox-group"
      className={cn({ 'flex flex-col gap-2': !inline, 'flex flex-row flex-wrap gap-4': inline })}
    >
      {Array.isArray(enumOptions) &&
        enumOptions.map((option, index: number) => {
          const checked = enumOptionsIsSelected<S>(option.value, checkboxesValues);
          const itemDisabled = Array.isArray(enumDisabled) && enumDisabled.indexOf(option.value) !== -1;
          const indexOptionId = optionId(id, index);

          return (
            <Field orientation="horizontal" className="items-center gap-2" key={indexOptionId}>
              <Checkbox
                id={indexOptionId}
                name={htmlName || id}
                required={required}
                disabled={disabled || itemDisabled || isReadonly}
                onCheckedChange={(state) => {
                  const on = state === true;
                  if (on) {
                    onChange(enumOptionsSelectValue<S>(index, checkboxesValues, enumOptions));
                  } else {
                    onChange(enumOptionsDeselectValue<S>(index, checkboxesValues, enumOptions));
                  }
                }}
                className={className}
                checked={checked}
                autoFocus={autofocus && index === 0}
                onBlur={_onBlur}
                onFocus={_onFocus}
                aria-describedby={ariaDescribedByIds(id)}
              />
              <FieldLabel className="leading-tight">{option.label}</FieldLabel>
            </Field>
          );
        })}
    </FieldGroup>
  );
}
