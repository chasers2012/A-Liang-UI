'use client';

import type { ReactNode } from 'react';

export function SectionHeader({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <h4 className={`mt-2.5 font-semibold uppercase tracking-wider text-muted-foreground ${className}`}>{children}</h4>
  );
}
