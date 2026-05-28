'use client';

import { MoreHorizontal } from 'lucide-react';
import type { Key, MouseEventHandler, ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import type { SearchListAction } from './types';

function SearchListActionTooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex shrink-0">{children}</span>} />
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

export function SearchListToolbarActions({ actions }: { actions?: readonly SearchListAction[] }) {
  if (!actions?.length) return null;

  const renderIconButton = (action: SearchListAction, key: Key) => {
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

  const renderOne = (action: SearchListAction, key: Key) => {
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
