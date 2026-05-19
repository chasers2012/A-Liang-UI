import type { LucideIcon } from 'lucide-react';
import { AlertCircle, Inbox } from 'lucide-react';
import type { ReactNode } from 'react';

import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

export type EmptyStateVariant = 'default' | 'loading' | 'error';

export interface EmptyStateProps {
  title: string;
  description?: string;
  variant?: EmptyStateVariant;
  icon?: LucideIcon;
  /** 紧凑布局，用于表格单元格、侧栏片段等。 */
  compact?: boolean;
  className?: string;
  children?: ReactNode;
}

export function EmptyState({
  title,
  description,
  variant = 'default',
  icon,
  compact = false,
  className,
  children,
}: EmptyStateProps) {
  const Icon = icon ?? (variant === 'error' ? AlertCircle : Inbox);

  return (
    <Empty className={cn('min-h-0 flex-1 border-0', compact ? 'gap-2 p-4' : 'p-6', className)}>
      <EmptyHeader className={compact ? 'gap-1' : undefined}>
        <EmptyMedia variant="icon" className={compact ? 'mb-0 size-8 [&_svg]:size-4' : undefined}>
          {variant === 'loading' ? (
            <Spinner className={compact ? 'size-4' : 'size-6'} />
          ) : (
            <Icon aria-hidden className={compact ? 'size-4' : undefined} />
          )}
        </EmptyMedia>
        <EmptyTitle className={compact ? 'text-sm' : undefined}>{title}</EmptyTitle>
        {description ? <EmptyDescription>{description}</EmptyDescription> : null}
      </EmptyHeader>
      {children ? <EmptyContent>{children}</EmptyContent> : null}
    </Empty>
  );
}

/** SearchList 无数据 / 加载 / 错误时的默认占位。 */
export function SearchListEmpty(props: EmptyStateProps) {
  return <EmptyState {...props} className={cn('min-h-40', props.className)} />;
}

/** 详情面板内未选中或加载中的占位。 */
export function PanelPlaceholder(props: {
  loading?: boolean;
  title: string;
  description?: string;
  className?: string;
}) {
  const { loading, title, description, className } = props;
  if (loading) {
    return <EmptyState variant="loading" title="加载中" description={description} compact className={className} />;
  }
  return <EmptyState title={title} description={description} compact className={cn('py-8', className)} />;
}

export function resolveAsyncListEmptyState(input: {
  loading?: boolean;
  error?: string | null;
  itemCount?: number;
  emptyTitle: string;
  emptyDescription: string;
  filterEmptyDescription?: string;
  loadingTitle?: string;
  errorTitle?: string;
}): Pick<EmptyStateProps, 'variant' | 'title' | 'description'> {
  const {
    loading,
    error,
    itemCount = 0,
    emptyTitle,
    emptyDescription,
    filterEmptyDescription,
    loadingTitle = '加载中',
    errorTitle = '加载失败',
  } = input;

  if (loading) {
    return { variant: 'loading', title: loadingTitle };
  }
  if (error) {
    return { variant: 'error', title: errorTitle, description: error };
  }
  if (itemCount === 0) {
    return { variant: 'default', title: emptyTitle, description: emptyDescription };
  }
  return {
    variant: 'default',
    title: '无匹配结果',
    description: filterEmptyDescription ?? '请调整搜索条件后重试。',
  };
}
