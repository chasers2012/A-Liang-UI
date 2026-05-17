'use client';

import { Maximize2 } from 'lucide-react';
import { useReactFlow, type FitViewOptions } from 'reactflow';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const WORKFLOW_GRAPH_DEFAULT_FIT_VIEW: FitViewOptions = {
  padding: 0.18,
  duration: 200,
};

export type WorkflowGraphFitViewButtonProps = {
  fitViewOptions?: FitViewOptions;
  className?: string;
};

export function WorkflowGraphFitViewButton(props: WorkflowGraphFitViewButtonProps) {
  const { fitViewOptions = WORKFLOW_GRAPH_DEFAULT_FIT_VIEW, className } = props;
  const { fitView } = useReactFlow();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn('h-8 w-8 rounded-none', className)}
      onClick={() => fitView(fitViewOptions)}
      aria-label="适应画布"
      title="适应画布"
    >
      <Maximize2 className="size-4" />
    </Button>
  );
}
