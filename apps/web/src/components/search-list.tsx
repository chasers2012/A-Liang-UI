'use client';

import { ChevronRight, MoreHorizontal } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  Fragment,
  useCallback,
  useMemo,
  useState,
  type ComponentProps,
  type DragEvent,
  type MouseEventHandler,
  type ReactNode,
} from 'react';

import { Item, ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { SectionHeader } from '@/components/section';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { SearchInput } from '@/components/search-input';

/** 列表拖拽时使用的 DataTransfer MIME（避免与普通文本拖放冲突）。 */
export const SEARCH_LIST_DRAG_MIME = 'application/x-search-list';

export type SearchListItemBase = {
  id: string;
};

export type SearchListRenderItemProps<TItem extends SearchListItemBase> = {
  item: TItem;
  selectedId?: string | null;
  description: string;
  title: ReactNode;
};

export type SearchListItemProps<TItem extends SearchListItemBase> = SearchListRenderItemProps<TItem> & {
  onItemSelected?: (item: TItem) => void;
  onItemDrag?: (item: TItem, e: DragEvent<HTMLDivElement>) => void;
};

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
        <ItemDescription className="min-h-10 line-clamp-2">{description || '-'}</ItemDescription>
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

function defaultRenderItem<TItem extends SearchListItemBase>(params: SearchListRenderItemProps<TItem>) {
  return <SearchListItem {...params} />;
}

/** 工具栏操作：`render` 自定义控件；否则用 `icon` + 其余 props 渲染默认 {@link Button}。 */
export type SearchListAction = {
  label: string;
  render?: () => ReactNode;
  icon?: LucideIcon;
} & Omit<ComponentProps<typeof Button>, 'children'>;

function SearchListActionTooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex shrink-0">{children}</span>} />
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

function SearchListToolbarActions({ actions }: { actions?: readonly SearchListAction[] }) {
  if (!actions?.length) return null;

  const renderIconButton = (action: SearchListAction, key: React.Key) => {
    const { label, icon: Icon, render, ...btnProps } = action;
    void render;
    if (!Icon) return null;
    return (
      <SearchListActionTooltip key={key} label={label}>
        <Button type="button" size="icon" aria-label={label} {...btnProps}>
          <Icon className="size-4" aria-hidden />
        </Button>
      </SearchListActionTooltip>
    );
  };

  const renderOne = (action: SearchListAction, key: React.Key) => {
    if (action.render) {
      return (
        <SearchListActionTooltip key={key} label={action.label}>
          {action.render()}
        </SearchListActionTooltip>
      );
    }
    return renderIconButton(action, key);
  };

  if (actions.length <= 2) {
    return (
      <div className="flex shrink-0 flex-row items-center justify-end gap-1">
        {actions.map((a, i) => renderOne(a, i))}
      </div>
    );
  }

  const [first, ...rest] = actions;
  return (
    <div className="flex shrink-0 flex-row items-center justify-end gap-1">
      {renderOne(first, 0)}
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger
            render={
              <span className="inline-flex shrink-0">
                <DropdownMenuTrigger
                  render={
                    <Button type="button" variant="ghost" size="icon" aria-label="更多操作">
                      <MoreHorizontal className="size-4" aria-hidden />
                    </Button>
                  }
                />
              </span>
            }
          />
          <TooltipContent side="top">更多操作</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" sideOffset={4} className="min-w-40">
          {rest.map((action, i) => {
            const key = i + 1;
            if (action.render) {
              return (
                <DropdownMenuItem key={key} className="cursor-default p-2 focus:bg-transparent">
                  {action.render()}
                </DropdownMenuItem>
              );
            }
            const { label, icon: Icon, onClick, render } = action;
            void render;
            if (!Icon) return null;
            return (
              <DropdownMenuItem
                key={key}
                onClick={(e) => {
                  if (!onClick) return;
                  (onClick as MouseEventHandler<HTMLElement>)(e);
                }}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                <span>{label}</span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
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
        <div className={cn('min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden px-2', listClassName)}>
          <div className="flex flex-col pb-2">
            {filteredItems && filteredItems.length > 0
              ? groupedItems?.map(([group, list]) => {
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
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })
              : (children ?? null)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
