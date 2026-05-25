'use client';

import { Trash } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Item, ItemDescription, ItemTitle } from '@/components/ui/item';
import { cn } from '@/lib/utils';
import type { SearchListRenderItemProps } from '@/components/search-list/types';

export type KnowledgeDocumentListItemData = {
  id: string;
  label: string;
  description: string;
  status: string;
};

function toLocalTime(v: string): string {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString();
}

export function formatKnowledgeDocumentDescription(status: string, updatedAt: string): string {
  const statusLabel = status === 'indexed' ? '已完成索引' : '未完成索引';
  return `${statusLabel} · ${toLocalTime(updatedAt)}`;
}

export function knowledgeDocumentStatusGroup(status: string): string {
  return status === 'indexed' ? '已完成索引' : '未完成索引';
}

export function KnowledgeDocumentListItem({
  item,
  selectedId,
  busyDocumentId,
  onSelect,
  onDelete,
}: SearchListRenderItemProps<KnowledgeDocumentListItemData> & {
  busyDocumentId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const isBusy = busyDocumentId === item.id;
  const isSelected = item.id === selectedId;

  return (
    <Item
      variant="outline"
      size="sm"
      role="button"
      tabIndex={0}
      className={cn(
        'grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 overflow-hidden',
        'cursor-pointer text-left outline-none',
        {
          'border-primary bg-muted/50 ring-1 ring-primary/35': isSelected,
        },
      )}
      onClick={() => onSelect(item.id)}
    >
      <div className="min-w-0 space-y-0.5">
        <ItemTitle className="block w-full min-w-0 truncate">{item.label}</ItemTitle>
        <ItemDescription className="line-clamp-1 min-w-0">{item.description}</ItemDescription>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="shrink-0"
        disabled={isBusy}
        aria-label={`删除文档 ${item.label}`}
        onClick={(e) => {
          e.stopPropagation();
          onDelete(item.id);
        }}
      >
        <Trash className="size-4" />
      </Button>
    </Item>
  );
}
