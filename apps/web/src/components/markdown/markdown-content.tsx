'use client';

import { IncremarkContent, type IncremarkContentProps } from '@incremark/react';

import { cn } from '@/lib/utils';

export type MarkdownContentProps = IncremarkContentProps & {
  /** 包裹 IncremarkContent 的外层容器 className */
  className?: string;
};

export function MarkdownContent({ className, isFinished = true, ...incremarkProps }: MarkdownContentProps) {
  return (
    <div className={cn('ai-chat-md wrap-break-word text-xs leading-relaxed', className)}>
      <IncremarkContent isFinished={isFinished} {...incremarkProps} />
    </div>
  );
}
