import type { ComponentPropsWithoutRef, ReactNode } from 'react';

import { cn } from '@/lib/utils';

type StepperProps = {
  children: ReactNode;
  className?: string;
};

type StepperItemProps = {
  index: number;
  title: string;
  description?: string;
  active?: boolean;
  completed?: boolean;
  disabled?: boolean;
  className?: string;
};

function Stepper({ children, className }: StepperProps) {
  return <ol className={cn('grid gap-3 sm:grid-cols-2', className)}>{children}</ol>;
}

function StepperItem({
  index,
  title,
  description,
  active = false,
  completed = false,
  disabled,
  className,
  onClick,
  ...props
}: StepperItemProps & ComponentPropsWithoutRef<'button'>) {
  return (
    <li>
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={cn(
          'group flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors',
          active
            ? 'border-primary bg-primary/5'
            : completed
              ? 'border-emerald-500/40 bg-emerald-500/5'
              : 'border-border bg-card hover:bg-muted/40',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      >
        <span
          className={cn(
            'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
            active
              ? 'border-primary bg-primary text-primary-foreground'
              : completed
                ? 'border-emerald-600 bg-emerald-600 text-white'
                : 'border-border text-muted-foreground',
          )}
        >
          {index + 1}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-medium">{title}</span>
          {description ? <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span> : null}
        </span>
      </button>
    </li>
  );
}

export { Stepper, StepperItem };
