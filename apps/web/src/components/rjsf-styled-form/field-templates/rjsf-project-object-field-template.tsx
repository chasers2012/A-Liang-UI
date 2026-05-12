'use client';

import {
  buttonId,
  canExpand,
  descriptionId,
  FormContextType,
  GenericObjectType,
  getTemplate,
  getUiOptions,
  ObjectFieldTemplateProps,
  RJSFSchema,
  StrictRJSFSchema,
  titleId,
} from '@rjsf/utils';

import { createElement, type ReactNode } from 'react';

import { FieldGroup } from '@/components/ui/field';

type RjsfProjectFormContext = Record<string, unknown> & { __rjsfProjectReadonly?: boolean };

/** Same as @rjsf/shadcn ObjectFieldTemplate but wraps properties in FieldGroup for consistent field spacing. */
export default function RjsfProjectObjectFieldTemplate<
  T extends GenericObjectType = GenericObjectType,
  S extends StrictRJSFSchema = RJSFSchema,
  F extends FormContextType = GenericObjectType,
>({
  description,
  title,
  properties,
  required,
  uiSchema,
  fieldPathId,
  schema,
  formData,
  optionalDataControl,
  onAddProperty,
  disabled,
  readonly,
  registry,
}: ObjectFieldTemplateProps<T, S, F>) {
  const forcedReadonly = Boolean((registry.formContext as RjsfProjectFormContext | undefined)?.__rjsfProjectReadonly);
  const isReadonly = readonly || forcedReadonly;
  const uiOptions = getUiOptions<T, S, F>(uiSchema);
  const TitleFieldTemplate = getTemplate<'TitleFieldTemplate', T, S, F>('TitleFieldTemplate', registry, uiOptions);
  const DescriptionFieldTemplate = getTemplate<'DescriptionFieldTemplate', T, S, F>(
    'DescriptionFieldTemplate',
    registry,
    uiOptions,
  );
  const showOptionalDataControlInTitle = !isReadonly && !disabled;
  const {
    ButtonTemplates: { AddButton },
  } = registry.templates;

  return (
    <>
      {title
        ? createElement(TitleFieldTemplate, {
            id: titleId(fieldPathId),
            title,
            required,
            schema,
            uiSchema,
            registry,
            optionalDataControl: showOptionalDataControlInTitle ? optionalDataControl : undefined,
          })
        : null}
      {description
        ? createElement(DescriptionFieldTemplate, {
            id: descriptionId(fieldPathId),
            description,
            schema,
            uiSchema,
            registry,
          })
        : null}
      <FieldGroup className="gap-2">
        {!showOptionalDataControlInTitle ? optionalDataControl : undefined}
        {properties.map((element: { hidden?: boolean; content: unknown }, index: number) => (
          <div key={index} className={`${element.hidden ? 'hidden' : ''} flex`}>
            <div className="w-full">{element.content as ReactNode}</div>
          </div>
        ))}
        {canExpand(schema, uiSchema, formData) ? (
          <div className="mt-2 flex justify-end">
            <AddButton
              id={buttonId(fieldPathId, 'add')}
              onClick={onAddProperty}
              disabled={disabled || isReadonly}
              className="rjsf-object-property-expand"
              uiSchema={uiSchema}
              registry={registry}
            />
          </div>
        ) : null}
      </FieldGroup>
    </>
  );
}
