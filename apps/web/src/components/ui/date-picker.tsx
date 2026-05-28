'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { CalendarIcon, ChevronDownIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

function ymdToDate(ymd: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return undefined;
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function dateToYmd(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export type DatePickerProps = {
  id?: string;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  /** 浏览态只读：不灰显为 disabled，且无法打开日历 */
  readOnly?: boolean;
  placeholder?: string;
  className?: string;
  size?: 'sm' | 'default';
  required?: boolean;
};

export function DatePicker({
  id,
  value,
  onChange,
  disabled,
  readOnly,
  placeholder = '选择日期',
  className,
  size = 'default',
  required,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const ymd = value;
  const selected = ymd ? ymdToDate(ymd) : undefined;
  const blockInteraction = Boolean(disabled) || Boolean(readOnly);

  React.useEffect(() => {
    if (blockInteraction) setOpen(false);
  }, [blockInteraction]);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (blockInteraction && next) return;
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-readonly={readOnly || undefined}
          aria-required={required}
          data-size={size}
          className={cn(
            'w-full justify-between font-normal data-[empty=true]:text-muted-foreground',
            size === 'sm' && 'h-7 rounded-[min(var(--radius-md),10px)] text-xs',
            className,
          )}
          data-empty={!ymd}
        >
          <span className="truncate">{selected ? format(selected, 'PPP', { locale: zhCN }) : placeholder}</span>
          <CalendarIcon className={cn('shrink-0 text-muted-foreground', size === 'sm' ? 'size-3.5' : 'size-4')} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto overflow-hidden p-0" align="start">
        <Calendar
          mode="single"
          captionLayout="dropdown"
          selected={selected}
          defaultMonth={selected}
          className={cn(size === 'sm' && '[--cell-size:--spacing(7)]')}
          onSelect={(d) => {
            if (blockInteraction) return;
            if (!d) {
              onChange('');
              return;
            }
            onChange(dateToYmd(d));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

export type DateTimePickerProps = {
  id?: string;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  className?: string;
  size?: 'sm' | 'default';
};

export function DateTimePicker({
  id,
  value,
  onChange,
  disabled,
  readOnly,
  placeholder = '选择日期时间',
  className,
  size = 'default',
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const local = value;
  const [datePart, timePart] = React.useMemo(() => {
    const trimmed = local.trim();
    if (!trimmed) return ['', '00:00'] as const;
    const idx = trimmed.indexOf('T');
    if (idx === -1) return [trimmed, '00:00'] as const;
    return [trimmed.slice(0, idx), trimmed.slice(idx + 1).slice(0, 5) || '00:00'] as const;
  }, [local]);

  const selected = datePart ? ymdToDate(datePart) : undefined;
  const [time, setTime] = React.useState(timePart);
  React.useEffect(() => {
    setTime(timePart);
  }, [timePart]);

  const blockInteraction = Boolean(disabled) || Boolean(readOnly);

  React.useEffect(() => {
    if (blockInteraction) setOpen(false);
  }, [blockInteraction]);

  const commit = React.useCallback(
    (nextDate: Date | undefined, nextTime: string) => {
      if (blockInteraction) return;
      if (!nextDate) {
        onChange('');
        return;
      }
      const t = (nextTime || '00:00').slice(0, 5);
      if (!/^\d{2}:\d{2}$/.test(t)) return;
      onChange(`${dateToYmd(nextDate)}T${t}`);
    },
    [blockInteraction, onChange],
  );

  const display = selected != null ? `${format(selected, 'PPP', { locale: zhCN })} ${time || '00:00'}` : null;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (blockInteraction && next) return;
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-readonly={readOnly || undefined}
          data-size={size}
          className={cn(
            'w-full justify-between font-normal data-[empty=true]:text-muted-foreground',
            size === 'sm' && 'h-7 rounded-[min(var(--radius-md),10px)] text-xs',
            className,
          )}
          data-empty={!display}
        >
          <span className="truncate text-left">{display ?? placeholder}</span>
          <ChevronDownIcon className={cn('shrink-0 text-muted-foreground', size === 'sm' ? 'size-3.5' : 'size-4')} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto overflow-hidden p-0" align="start">
        <div className="flex flex-col gap-2 p-2">
          <Calendar
            mode="single"
            captionLayout="dropdown"
            selected={selected}
            defaultMonth={selected}
            className={cn('rounded-md border-0 p-1 shadow-none', size === 'sm' && '[--cell-size:--spacing(7)]')}
            onSelect={(d) => {
              if (blockInteraction) return;
              if (d) commit(d, time);
            }}
          />
          <div className="flex items-center gap-2 border-t border-border/60 px-1 pb-1 pt-2">
            <span className="text-muted-foreground text-xs whitespace-nowrap">时间</span>
            <Input
              type="time"
              step={60}
              disabled={disabled}
              readOnly={Boolean(readOnly) && !disabled}
              className={cn('font-mono', size === 'sm' ? 'h-7 text-xs' : 'h-8')}
              value={time}
              onChange={(e) => {
                if (blockInteraction) return;
                const next = e.target.value.slice(0, 5);
                setTime(next);
                if (selected) commit(selected, next);
              }}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
