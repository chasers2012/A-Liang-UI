'use client';

import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { FieldTemplateProps } from '@rjsf/utils';
import type { ReactNode } from 'react';
import { HelpCircle } from 'lucide-react';

function FieldDescriptionTooltip({ description, ariaContext }: { description: string; ariaContext: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className="inline-flex cursor-help items-center text-muted-foreground hover:text-foreground"
            aria-label={`${ariaContext} 字段说明`}
          >
            <HelpCircle className="size-3.5" />
          </span>
        }
      />
      <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
        {description}
      </TooltipContent>
    </Tooltip>
  );
}

function buildFieldBody(args: {
  id: string;
  label: string;
  required?: boolean;
  displayLabel?: boolean;
  showDescriptionTooltip: boolean;
  description: string;
  children: ReactNode;
}): ReactNode {
  const { id, label, required, displayLabel, showDescriptionTooltip, description, children } = args;

  if (displayLabel) {
    return (
      <>
        {showDescriptionTooltip ? (
          <div className="flex items-center gap-1.5">
            <FieldLabel htmlFor={id} className="w-fit">
              {label}
              {required ? <span className="text-destructive">*</span> : null}
            </FieldLabel>
            <FieldDescriptionTooltip description={description} ariaContext={label} />
          </div>
        ) : (
          <FieldLabel htmlFor={id} className="w-fit">
            {label}
            {required ? <span className="text-destructive">*</span> : null}
          </FieldLabel>
        )}
        {children}
      </>
    );
  }

  if (showDescriptionTooltip) {
    return (
      <div className="flex items-center gap-1.5">
        {children}
        <FieldDescriptionTooltip description={description} ariaContext={label || id} />
      </div>
    );
  }

  return children;
}

export function HoverDescriptionFieldTemplate(props: FieldTemplateProps) {
  const {
    id,
    classNames,
    style,
    hidden,
    required,
    readonly,
    disabled,
    label,
    displayLabel,
    rawDescription,
    rawErrors,
    errors,
    help,
    hideError,
    children,
  } = props;

  if (hidden) return null;

  const description = typeof rawDescription === 'string' ? rawDescription.trim() : '';
  const showDescriptionTooltip = description.length > 0;
  const showFieldErrors = !hideError && !readonly && !disabled;
  const invalid = showFieldErrors && Array.isArray(rawErrors) && rawErrors.length > 0;

  const errorSlot =
    showFieldErrors && rawErrors && rawErrors.length > 0 ? (
      <FieldError errors={rawErrors.map((message) => ({ message }))} />
    ) : showFieldErrors && errors ? (
      <FieldError>{errors}</FieldError>
    ) : null;

  return (
    <Field data-invalid={invalid || undefined} className={cn('gap-2', classNames)} style={style}>
      {buildFieldBody({
        id,
        label,
        required,
        displayLabel,
        showDescriptionTooltip,
        description,
        children,
      })}
      {errorSlot}
      {help}
    </Field>
  );
}
