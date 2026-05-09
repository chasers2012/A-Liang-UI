import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export function FormSection({
  title,
  description,
  className,
  children,
}: {
  title: string;
  description?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn('space-y-3', className)}>
      <header className="space-y-0.5 pb-2">
        <h3 className="text-sm font-medium tracking-tight">{title}</h3>
        {description ? <p className="text-xs leading-relaxed text-muted-foreground">{description}</p> : null}
      </header>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function FieldPair({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}
