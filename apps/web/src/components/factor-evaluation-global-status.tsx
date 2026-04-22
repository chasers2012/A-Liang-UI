'use client';

import Link from 'next/link';
import { useAtomValue } from 'jotai';
import { Loader2 } from 'lucide-react';

import { factorEvaluationRunningAtom } from '@/models/factor';
import { cn } from '@/lib/utils';

export function FactorEvaluationGlobalStatus() {
  const running = useAtomValue(factorEvaluationRunningAtom);
  if (!running) return null;

  return (
    <Link
      href={`/factors/${encodeURIComponent(running.factorId)}`}
      className={cn(
        'inline-flex max-w-[min(20rem,50vw)] items-center gap-2 rounded-md border border-border/80 bg-muted/40 px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-muted/60',
      )}
    >
      <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" aria-hidden />
      <span className="min-w-0 truncate">
        评价进行中：
        <span className="font-mono font-medium">{running.factorName}</span>
      </span>
    </Link>
  );
}
