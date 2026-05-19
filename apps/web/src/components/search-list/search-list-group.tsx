'use client';

import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

import { SectionHeader } from '@/components/section';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

export function SearchListGroup(props: {
  group: string;
  count: number;
  isCollapsed: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const { group, count, isCollapsed, onToggle, children } = props;

  return (
    <Collapsible open={!isCollapsed} onOpenChange={onToggle}>
      <CollapsibleTrigger className="sticky left-0 right-0 top-0 z-10 w-full bg-card py-3.5 pl-2 text-left">
        <SectionHeader className="mt-0 flex items-center gap-1 py-0">
          <ChevronRight className={cn('size-4 transition-transform', !isCollapsed && 'rotate-90')} />
          <span>{group}</span>
          <span className="text-xs normal-case text-muted-foreground/80">({count})</span>
        </SectionHeader>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2">{children}</CollapsibleContent>
    </Collapsible>
  );
}
