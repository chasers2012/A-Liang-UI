'use client';

import { Search } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';

import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Item, ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item';
import { SectionHeader } from '@/components/section-header';
import { cn } from '@/lib/utils';

import { WORKFLOW_GRAPH_NODE_DRAG_MIME } from './workflow-graph-canvas';
import { NodeSummaryPublic } from '@/models/nodes/dto';

export type WorkflowNodeTypeListItem = {
  type: string;
  label: string;
  description?: string | null;
  category?: string | null;
};

function NodeItem(props: {
  item: WorkflowNodeTypeListItem;
  selectedType?: string | null;
  description: string;
  onSelectType?: (type: string) => void;
  draggable: boolean;
  dragMime: string;
}) {
  const { item, selectedType, description, onSelectType, draggable, dragMime } = props;
  return (
    <Item
      key={item.type}
      variant="outline"
      className={cn({
        'border-primary bg-muted/50 ring-1 ring-primary/35': item.type === selectedType,
      })}
      render={
        <div
          role="button"
          tabIndex={0}
          className="w-full cursor-pointer text-left outline-none"
          onClick={() => onSelectType?.(item.type)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelectType?.(item.type);
            }
          }}
          draggable={draggable}
          onDragStart={(e) => {
            if (!draggable) return;
            e.dataTransfer.setData(dragMime, item.type);
            e.dataTransfer.effectAllowed = 'copy';
          }}
        />
      }
    >
      <ItemContent className="overflow-hidden">
        <ItemTitle>{item.label}</ItemTitle>
        {description ? <ItemDescription>{description}</ItemDescription> : null}
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

export function WorkflowNodeTypeList(props: {
  items: WorkflowNodeTypeListItem[] | null;
  searchPlaceholder?: string;
  searchQuery?: string;
  onSearchQueryChange?: (value: string) => void;
  selectedType?: string | null;
  error?: string | null;
  loadingText?: string;
  emptyText?: string;
  className?: string;
  listClassName?: string;
  toolbarRight?: ReactNode;
  onSelectType?: (type: string) => void;
  draggable?: boolean;
  dragMime?: string;
}) {
  const {
    items,
    searchPlaceholder = '搜索名称/描述',
    searchQuery,
    onSearchQueryChange,
    selectedType,
    error,
    loadingText = '加载中…',
    emptyText = '暂无节点',
    className,
    listClassName,
    toolbarRight,
    onSelectType,
    draggable = true,
    dragMime = WORKFLOW_GRAPH_NODE_DRAG_MIME,
  } = props;
  const [innerQuery, setInnerQuery] = useState('');
  const effectiveQuery = searchQuery ?? innerQuery;

  const filteredItems = useMemo(() => {
    if (!items) return null;
    const q = effectiveQuery.trim().toLocaleLowerCase('zh-CN');
    if (!q) return items;
    return items.filter((item) => {
      const text = [item.label, item.description ?? '', item.category ?? ''].join(' ').toLocaleLowerCase('zh-CN');
      return text.includes(q);
    });
  }, [items, effectiveQuery]);

  const groupedItems = useMemo(() => {
    if (!filteredItems) return null;
    const groups = new Map<string, WorkflowNodeTypeListItem[]>();
    for (const item of filteredItems) {
      const key = item.category?.trim() || '其他';
      const list = groups.get(key);
      if (list) list.push(item);
      else groups.set(key, [item]);
    }
    return [...groups.entries()];
  }, [filteredItems]);

  return (
    <aside className={cn('flex min-h-0 flex-col overflow-hidden', className)}>
      <div className="flex w-full shrink-0 flex-row items-center justify-between gap-2 border-b px-2 pb-3 pt-0">
        <InputGroup className="max-w-xs">
          <InputGroupInput
            placeholder={searchPlaceholder}
            value={effectiveQuery}
            onChange={(e) => {
              if (onSearchQueryChange) onSearchQueryChange(e.target.value);
              else setInnerQuery(e.target.value);
            }}
            aria-label={searchPlaceholder}
          />
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
        </InputGroup>
        {toolbarRight ? <div className="flex flex-row justify-end gap-1">{toolbarRight}</div> : null}
      </div>
      <div className={cn('min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden pl-1 pr-1', listClassName)}>
        <div className="flex flex-col gap-1 py-2">
          {!filteredItems ? (
            error ? (
              <p className="p-6 text-sm text-destructive">{error}</p>
            ) : (
              <p className="p-6 text-sm text-muted-foreground">{loadingText}</p>
            )
          ) : filteredItems.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">{emptyText}</p>
          ) : (
            groupedItems?.map(([category, list]) => (
              <section key={category} className="space-y-1">
                <div className="px-3 pt-1 pb-2 ">
                  <SectionHeader>{category}</SectionHeader>
                </div>
                {list.map((item) => {
                  const description = toPlainTextFirstLinePreview(item.description);
                  return (
                    <NodeItem
                      key={item.type}
                      item={item}
                      selectedType={selectedType}
                      description={description}
                      onSelectType={onSelectType}
                      draggable={draggable}
                      dragMime={dragMime}
                    />
                  );
                })}
              </section>
            ))
          )}
        </div>
      </div>
    </aside>
  );
}
