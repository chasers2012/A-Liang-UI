"use client";

import type { ReactNode } from "react";

export function SectionHeader({ children }: { children: ReactNode }) {
  return (
    <h4 className="mt-2.5 font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </h4>
  );
}

