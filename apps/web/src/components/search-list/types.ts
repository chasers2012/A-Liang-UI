import type { LucideIcon } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';

import type { Button } from '@/components/ui/button';
import type { Item } from '@/components/ui/item';

export type SearchListItemBase = {
  id: string;
};

export type SearchListRenderItemProps<TItem extends SearchListItemBase> = {
  item: TItem;
  selectedId?: string | null;
};

export type SearchListItemProps<TItem extends SearchListItemBase> = SearchListRenderItemProps<TItem> &
  Omit<ComponentProps<typeof Item>, 'children' | 'render' | 'title'> & {
    title: ReactNode;
    description?: ReactNode;
    /** 紧凑模式：仅显示标题，不显示描述。 */
    dense?: boolean;
  };

/** 工具栏操作：`render` 自定义控件；否则用 `icon` + 其余 props 渲染默认 {@link Button}。 */
export type SearchListAction = {
  label: string;
  render?: () => ReactNode;
  icon?: LucideIcon;
} & Omit<ComponentProps<typeof Button>, 'children'>;
