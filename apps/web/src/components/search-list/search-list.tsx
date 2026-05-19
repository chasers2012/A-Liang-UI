'use client';

import { Fragment, useCallback, useMemo, useState, type ReactNode } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SearchInput } from '@/components/search-input';
import { cn } from '@/lib/utils';

import { SearchListGroup } from './search-list-group';
import { SearchListToolbarActions } from './toolbar-actions';
import type { SearchListAction, SearchListItemBase, SearchListRenderItemProps } from './types';

function buildItemSearchText<TItem extends SearchListItemBase>(
  item: TItem,
  searchKeys: readonly (keyof TItem & string)[],
): string {
  return searchKeys
    .map((key) => {
      const value = item[key];
      if (value == null) return '';
      return typeof value === 'string' ? value : String(value);
    })
    .join(' ');
}

export function SearchList<TItem extends SearchListItemBase>(props: {
  items: TItem[] | null;
  /** 未传入时不分组，直接平铺列表项。 */
  getGroupKey?: (item: TItem) => unknown;
  /** 参与搜索的 item 字段名列表，例如 `['label', 'description']`。 */
  searchKeys?: readonly (keyof TItem & string)[];
  title?: string;
  searchPlaceholder?: string;
  selectedId?: string | null;
  /** 无列表数据时展示（不区分加载与空列表，由调用方决定内容）。 */
  children?: ReactNode;
  className?: string;
  actions?: readonly SearchListAction[];
  renderItem: (params: SearchListRenderItemProps<TItem>) => ReactNode;
}) {
  const {
    items,
    getGroupKey,
    searchKeys,
    title = '列表',
    searchPlaceholder = '搜索',
    selectedId,
    children,
    className,
    actions,
    renderItem,
  } = props;

  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());

  const toggleGroup = useCallback((group: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }, []);

  const filteredItems = useMemo(() => {
    if (!items) return null;
    const q = searchQuery.trim().toLocaleLowerCase('zh-CN');
    if (!q) return items;
    return items.filter((item) => {
      if (!searchKeys?.length) return false;
      return buildItemSearchText(item, searchKeys).toLocaleLowerCase('zh-CN').includes(q);
    });
  }, [items, searchQuery, searchKeys]);

  const groupedItems = useMemo(() => {
    if (!filteredItems || !getGroupKey) return null;
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

  const renderListItem = useCallback((item: TItem) => renderItem({ item, selectedId }), [renderItem, selectedId]);

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
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <SearchListToolbarActions actions={actions} />
        </div>
        <div className="min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden px-2 flex flex-col pb-2">
          {filteredItems && filteredItems.length > 0 ? (
            getGroupKey ? (
              groupedItems?.map(([group, list]) => (
                <SearchListGroup
                  key={group}
                  group={group}
                  count={list.length}
                  isCollapsed={collapsedGroups.has(group)}
                  onToggle={() => toggleGroup(group)}
                >
                  {list.map((item) => (
                    <Fragment key={item.id}>{renderListItem(item)}</Fragment>
                  ))}
                </SearchListGroup>
              ))
            ) : (
              <div className="space-y-2">
                {filteredItems.map((item) => (
                  <Fragment key={item.id}>{renderListItem(item)}</Fragment>
                ))}
              </div>
            )
          ) : (
            (children ?? null)
          )}
        </div>
      </CardContent>
    </Card>
  );
}
