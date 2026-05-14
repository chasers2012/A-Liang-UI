'use client';

import { Fragment, useCallback, useMemo, useState, type ReactNode } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SearchInput } from '@/components/search-input';
import { cn } from '@/lib/utils';

import { toPlainTextFirstLinePreview } from './preview-text';
import { SearchListGroup } from './search-list-group';
import { SearchListItem } from './search-list-item';
import { SearchListToolbarActions } from './toolbar-actions';
import type { SearchListAction, SearchListItemBase, SearchListRenderItemProps } from './types';

function defaultRenderItem<TItem extends SearchListItemBase>(params: SearchListRenderItemProps<TItem>) {
  return <SearchListItem {...params} />;
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
  /** 无列表数据时展示（不区分加载与空列表，由调用方决定内容）。 */
  children?: ReactNode;
  className?: string;
  listClassName?: string;
  actions?: readonly SearchListAction[];
  /** 默认使用 {@link SearchListItem}。需要点击、拖拽等行为时自行传入并扩展 props。 */
  renderItem?: (params: SearchListRenderItemProps<TItem>) => ReactNode;
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
    children,
    className,
    listClassName,
    actions,
    renderItem = defaultRenderItem,
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
          <SearchListToolbarActions actions={actions} />
        </div>
        <div
          className={cn(
            'min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden px-2 flex flex-col pb-2',
            listClassName,
          )}
        >
          {filteredItems && filteredItems.length > 0
            ? groupedItems?.map(([group, list]) => (
                <SearchListGroup
                  key={group}
                  group={group}
                  count={list.length}
                  isCollapsed={collapsedGroups.has(group)}
                  onToggle={() => toggleGroup(group)}
                >
                  {list.map((item) => {
                    const descriptionNode = renderDescription?.(item);
                    const description =
                      typeof descriptionNode === 'string' ? toPlainTextFirstLinePreview(descriptionNode) : '';
                    return (
                      <Fragment key={item.id}>
                        {renderItem({
                          item,
                          title: renderTitle(item),
                          selectedId,
                          description,
                        })}
                      </Fragment>
                    );
                  })}
                </SearchListGroup>
              ))
            : (children ?? null)}
        </div>
      </CardContent>
    </Card>
  );
}
