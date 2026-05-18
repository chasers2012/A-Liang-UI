import type { LucideIcon } from 'lucide-react';
import type { ComponentProps, DragEvent, ReactNode } from 'react';

import type { Button } from '@/components/ui/button';

export type SearchListItemBase = {
  id: string;
};

export type SearchListRenderItemProps<TItem extends SearchListItemBase> = {
  item: TItem;
  selectedId?: string | null;
  description: ReactNode;
  title: ReactNode;
};

export type SearchListItemProps<TItem extends SearchListItemBase> = SearchListRenderItemProps<TItem> & {
  onItemSelected?: (item: TItem) => void;
  onItemDrag?: (item: TItem, e: DragEvent<HTMLDivElement>) => void;
};

/** 工具栏操作：`render` 自定义控件；否则用 `icon` + 其余 props 渲染默认 {@link Button}。 */
export type SearchListAction = {
  label: string;
  render?: () => ReactNode;
  icon?: LucideIcon;
} & Omit<ComponentProps<typeof Button>, 'children'>;
