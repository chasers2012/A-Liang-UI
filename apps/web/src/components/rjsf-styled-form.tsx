import { cn } from '@/lib/utils';

import Form from '@rjsf/shadcn';
import type { ComponentProps } from 'react';

type RjsfStyledFormProps = ComponentProps<typeof Form>;

const RJSF_BASE_CLASSNAME = cn(
  // Align RJSF layout/typography with shadcn (tailwind + CSS vars)
  'text-xs text-foreground',
  'space-y-2',
  // Field groups & spacing
  '[&_.form-group]:space-y-1 [&_.field]:space-y-1 [&_.array-item]:space-y-2',
  // Labels / descriptions
  '[&_.control-label]:text-xs [&_.control-label]:text-muted-foreground [&_label]:text-xs [&_label]:text-muted-foreground',
  '[&_.field-description]:text-xs [&_.field-description]:text-muted-foreground [&_.help-block]:text-xs [&_.help-block]:text-muted-foreground',
  // Errors
  '[&_.text-danger]:text-destructive [&_.error-detail]:text-destructive [&_.field-error]:text-destructive',
  // Inputs (covers default RJSF bootstrap-ish classnames)
  '[&_.form-control]:h-7 [&_.form-control]:rounded-md [&_.form-control]:border [&_.form-control]:border-input [&_.form-control]:bg-background [&_.form-control]:px-2 [&_.form-control]:py-1 [&_.form-control]:text-xs [&_.form-control]:shadow-sm',
  '[&_.form-control:focus]:outline-none [&_.form-control:focus]:ring-1 [&_.form-control:focus]:ring-ring',
  '[&_.form-control:disabled]:cursor-not-allowed [&_.form-control:disabled]:opacity-50',
  // Selects
  '[&_.form-select]:h-7 [&_.form-select]:rounded-md [&_.form-select]:border [&_.form-select]:border-input [&_.form-select]:bg-background [&_.form-select]:px-2 [&_.form-select]:text-xs [&_.form-select]:shadow-sm',
  '[&_.form-select:focus]:outline-none [&_.form-select:focus]:ring-1 [&_.form-select:focus]:ring-ring',
  // Checkboxes / radios
  '[&_.checkbox]:h-4 [&_.checkbox]:w-4 [&_.radio]:h-4 [&_.radio]:w-4',
);

function shouldStopWheelPropagation(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest(
      [
        'select',
        'textarea',
        '.form-select',
        '.form-control',
        '[role="listbox"]',
        '[data-radix-select-content]',
        '[data-radix-scroll-area-viewport]',
      ].join(','),
    ),
  );
}

export function RjsfStyledForm({ className, ...props }: RjsfStyledFormProps) {
  return (
    <div
      onWheelCapture={(e) => {
        if (shouldStopWheelPropagation(e.target)) {
          e.stopPropagation();
        }
      }}
    >
      <Form {...props} className={cn(RJSF_BASE_CLASSNAME, className)} />
    </div>
  );
}
