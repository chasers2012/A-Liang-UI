'use client';

import { ChevronRight } from 'lucide-react';
import { useCallback, useMemo, useState, type DragEvent, type ReactNode } from 'react';

import { Item, ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { SectionHeader } from '@/components/section-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { SearchInput } from '@/components/search-input';

/** 列表拖拽时使用的 DataTransfer MIME（避免与普通文本拖放冲突）。 */
export const SEARCH_LIST_DRAG_MIME = 'application/x-search-list';

export type SearchListItemBase = {
  id: string;
};

function SearchListItem<TItem extends SearchListItemBase>(props: {
  item: TItem;
  selectedId?: string | null;
  description: string;
  title: ReactNode;
  onItemSelected?: (item: TItem) => void;
  onItemDrag?: (item: TItem, e: DragEvent<HTMLDivElement>) => void;
}) {
  const { item, selectedId, description, title, onItemSelected, onItemDrag } = props;
  const draggable = Boolean(onItemDrag);
  return (
    <Item
      key={item.id}
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
        <ItemDescription className="min-h-10 line-clamp-2">{description || '\u00A0'}</ItemDescription>
      </ItemContent>
    </Item>
  );
}

function toPlainTextPreview(input?: string | null, maxLength = 120): string {
  if (!input) return '';
  const plain = input
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^>\s?/gm, '')
    .replace(/[#_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (plain.length <= maxLength) return plain;
  return `${plain.slice(0, maxLength)}...`;
}

/** 列表摘要：只取描述中第一个非空行，再作纯文本预览。 */
function toPlainTextFirstLinePreview(input?: string | null, maxLength = 120): string {
  if (!input) return '';
  let first = '';
  for (const line of input.split(/\r?\n/)) {
    const t = line.trim();
    if (t) {
      first = t;
      break;
    }
  }
  return toPlainTextPreview(first, maxLength);
}

export function SearchList<TItem extends SearchListItemBase>(props: {
  items: TItem[] | null;
  getGroupKey: (item: TItem) => unknown;
  renderTitle: (item: TItem) => ReactNode;
  renderDescription?: (item: TItem) => ReactNode;
  getSearchText?: (item: TItem) => string;
  title?: string;
  searchPlaceholder?: string;
  searchQuery?: string;
  onSearchQueryChange?: (value: string) => void;
  selectedId?: string | null;
  loadingText?: string;
  emptyText?: string;
  className?: string;
  listClassName?: string;
  toolbarRight?: ReactNode;
  onItemSelected?: (item: TItem) => void;
  onItemDrag?: (item: TItem, e: DragEvent<HTMLDivElement>) => void;
}) {
  const {
    items,
    getGroupKey,
    renderTitle,
    renderDescription,
    getSearchText,
    title = '列表',
    searchPlaceholder = '搜索',
    searchQuery,
    onSearchQueryChange,
    selectedId,
    loadingText = '加载中…',
    emptyText = '暂无数据',
    className,
    listClassName,
    toolbarRight,
    onItemSelected,
    onItemDrag,
  } = props;

  const [innerQuery, setInnerQuery] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());
  const effectiveQuery = searchQuery ?? innerQuery;

  const toggleGroup = useCallback((group: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }, []);

  const handleQueryChange = useCallback(
    (value: string) => {
      if (onSearchQueryChange) onSearchQueryChange(value);
      else setInnerQuery(value);
    },
    [onSearchQueryChange],
  );

  const filteredItems = useMemo(() => {
    if (!items) return null;
    const q = effectiveQuery.trim().toLocaleLowerCase('zh-CN');
    if (!q) return items;
    return items.filter((item) => {
      const titleNode = renderTitle(item);
      const fallbackText = typeof titleNode === 'string' ? titleNode : '';
      const text = (getSearchText ? getSearchText(item) : fallbackText).toLocaleLowerCase('zh-CN');
      return text.includes(q);
    });
  }, [items, effectiveQuery, getSearchText, renderTitle]);

  const groupedItems = useMemo(() => {
    if (!filteredItems) return null;
    const groups = new Map<string, TItem[]>();
    for (const item of filteredItems) {
      const raw = getGroupKey(item);
      const key = (typeof raw === 'string' ? raw : raw == null ? '' : String(raw)).trim() || '其他';
      const list = groups.get(key);
      if (list) list.push(item);
      else groups.set(key, [item]);
    }
    return [...groups.entries()];
  }, [filteredItems, getGroupKey]);

  return (
    <Card className={cn('flex min-h-0 flex-col overflow-hidden', className)}>
      <CardHeader className="shrink-0">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
        <div className="flex w-full shrink-0 flex-row items-center justify-between gap-2 border-b px-2 pb-3 pt-0">
          <SearchInput
            className="max-w-xs"
            placeholder={searchPlaceholder}
            value={effectiveQuery}
            onValueChange={handleQueryChange}
          />
          {toolbarRight ? <div className="flex flex-row justify-end gap-1">{toolbarRight}</div> : null}
        </div>
        <div className={cn('min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden pl-2 pr-1', listClassName)}>
          <div className="flex flex-col pb-2">
            {!filteredItems ? (
              <p className="p-6 text-sm text-muted-foreground">{loadingText}</p>
            ) : filteredItems.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">{emptyText}</p>
            ) : (
              groupedItems?.map(([group, list]) => {
                const isCollapsed = collapsedGroups.has(group);
                return (
                  <Collapsible
                    key={group}
                    className="space-y-2"
                    open={!isCollapsed}
                    onOpenChange={() => toggleGroup(group)}
                  >
                    <CollapsibleTrigger className="sticky left-0 right-0 top-0 z-10 w-full bg-card py-3 pl-2 text-left">
                      <SectionHeader className="mt-0 flex items-center gap-1 py-0">
                        <ChevronRight className={cn('size-4 transition-transform', !isCollapsed && 'rotate-90')} />
                        <span>{group}</span>
                        <span className="text-xs normal-case text-muted-foreground/80">({list.length})</span>
                      </SectionHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-2">
                      {list.map((item) => {
                        const descriptionNode = renderDescription?.(item);
                        const description =
                          typeof descriptionNode === 'string' ? toPlainTextFirstLinePreview(descriptionNode) : '';
                        return (
                          <SearchListItem
                            key={item.id}
                            item={item}
                            title={renderTitle(item)}
                            selectedId={selectedId}
                            description={description}
                            onItemSelected={onItemSelected}
                            onItemDrag={onItemDrag}
                          />
                        );
                      })}
                    </CollapsibleContent>
                  </Collapsible>
                );
              })
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
