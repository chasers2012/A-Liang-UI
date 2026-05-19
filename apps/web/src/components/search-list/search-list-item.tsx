'use client';

import { Item, ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item';
import { cn } from '@/lib/utils';

import type { SearchListItemBase, SearchListItemProps } from './types';

export function SearchListItem<TItem extends SearchListItemBase>(props: SearchListItemProps<TItem>) {
  const { item, selectedId, description, title, dense, className, variant = 'outline', ...itemProps } = props;

  return (
    <Item
      variant={variant}
      role="button"
      tabIndex={0}
      className={cn(
        'w-full cursor-pointer text-left outline-none',
        {
          'border-primary bg-muted/50 ring-1 ring-primary/35': item.id === selectedId,
        },
        className,
      )}
      {...itemProps}
    >
      <ItemContent className={cn('overflow-hidden', dense ? 'min-h-0' : 'min-h-18')}>
        <ItemTitle className="truncate">{title}</ItemTitle>
        {!dense && (
          <ItemDescription className="min-h-10 line-clamp-2 [&:not(:has(*))]:line-clamp-2">
            {description || '-'}
          </ItemDescription>
        )}
      </ItemContent>
    </Item>
  );
}
