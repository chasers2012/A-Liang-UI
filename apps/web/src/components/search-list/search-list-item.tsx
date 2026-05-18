'use client';

import { Item, ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item';
import { cn } from '@/lib/utils';

import type { SearchListItemBase, SearchListItemProps } from './types';

export function SearchListItem<TItem extends SearchListItemBase>(props: SearchListItemProps<TItem>) {
  const { item, selectedId, description, title, onItemSelected, onItemDrag } = props;
  const draggable = Boolean(onItemDrag);
  return (
    <Item
      variant="outline"
      className={cn({
        'border-primary bg-muted/50 ring-1 ring-primary/35': item.id === selectedId,
      })}
      render={
        <div
          role="button"
          tabIndex={0}
          className="w-full cursor-pointer text-left outline-none"
          onClick={() => onItemSelected?.(item)}
          draggable={draggable}
          onDragStart={(e) => {
            if (!onItemDrag) return;
            onItemDrag(item, e);
          }}
        />
      }
    >
      <ItemContent className="min-h-18 overflow-hidden">
        <ItemTitle className="truncate">{title}</ItemTitle>
        <ItemDescription className="min-h-10 line-clamp-2 [&:not(:has(*))]:line-clamp-2">
          {description ?? '-'}
        </ItemDescription>
      </ItemContent>
    </Item>
  );
}
