'use client';

import type { ReactNode } from 'react';

export function SectionHeader({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <h4 className={`font-semibold uppercase tracking-wider text-muted-foreground ${className}`}>{children}</h4>;
}

export function Section({
  title = '',
  children,
  className,
}: {
  title?: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div>
      <SectionHeader className="my-2.5">{title}</SectionHeader>
      <div className={className}>{children}</div>
    </div>
  );
}
