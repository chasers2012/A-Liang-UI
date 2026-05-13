'use client';
/* eslint-disable react-hooks/static-components -- RJSF resolves templates via getTemplate at render time (same pattern as @rjsf/shadcn CheckboxWidget). */

import {
  ariaDescribedByIds,
  descriptionId,
  FormContextType,
  GenericObjectType,
  getTemplate,
  labelValue,
  RJSFSchema,
  schemaRequiresTrueValue,
  StrictRJSFSchema,
  WidgetProps,
} from '@rjsf/utils';

import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldLabel } from '@/components/ui/field';

type RjsfProjectFormContext = Record<string, unknown> & { __rjsfProjectReadonly?: boolean };

export default function RjsfProjectCheckboxWidget<
  T extends GenericObjectType = GenericObjectType,
  S extends StrictRJSFSchema = RJSFSchema,
  F extends FormContextType = GenericObjectType,
>(props: WidgetProps<T, S, F>) {
  const {
    id,
    htmlName,
    value,
    disabled,
    readonly,
    label,
    hideLabel,
    schema,
    autofocus,
    options,
    onChange,
    onBlur,
    onFocus,
    registry,
    uiSchema,
    className,
    formContext,
  } = props;
  const forcedReadonly = Boolean((formContext as RjsfProjectFormContext | undefined)?.__rjsfProjectReadonly);
  const isReadonly = readonly || forcedReadonly;
  const required = schemaRequiresTrueValue<S>(schema);
  const DescriptionFieldTemplate = getTemplate<'DescriptionFieldTemplate', T, S, F>(
    'DescriptionFieldTemplate',
    registry,
    options,
  );

  const _onChange = (checked: boolean | 'indeterminate') => {
    if (isReadonly) return;
    onChange(checked === true);
  };
  const _onBlur = () => onBlur(id, value);
  const _onFocus = () => onFocus(id, value);

  const description = options.description || schema.description;
  return (
    <div
      className={`relative ${disabled || isReadonly ? 'cursor-not-allowed opacity-50' : ''}`}
      aria-describedby={ariaDescribedByIds(id)}
    >
      {!hideLabel && description ? (
        <DescriptionFieldTemplate
          id={descriptionId(id)}
          description={description}
          schema={schema}
          uiSchema={uiSchema}
          registry={registry}
        />
      ) : null}
      <Field orientation="horizontal" className="my-2 items-center gap-2">
        <Checkbox
          id={id}
          name={htmlName || id}
          checked={typeof value === 'undefined' ? false : Boolean(value)}
          required={required}
          disabled={disabled}
          readOnly={isReadonly}
          autoFocus={autofocus}
          onCheckedChange={_onChange}
          onBlur={_onBlur}
          onFocus={_onFocus}
          className={className}
        />
        <FieldLabel className="leading-tight">{labelValue(label, hideLabel || !label)}</FieldLabel>
      </Field>
    </div>
  );
}
