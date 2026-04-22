'use client';

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface EditablePageTitleProps {
  value: string;
  onChange: (value: string) => void;
  /** 输入框的无障碍名称，默认「名称」 */
  inputAriaLabel?: string;
  /** 编辑按钮的无障碍名称，默认「编辑」 */
  editButtonAriaLabel?: string;
  /** 展示态为空时的占位文本，默认「（未命名）」 */
  emptyDisplayText?: string;
  /** 输入态可提交的最小长度，默认 1（trim 后） */
  minTrimmedLengthToCommit?: number;
}

export function EditablePageTitle({
  value,
  onChange,
  inputAriaLabel = '名称',
  editButtonAriaLabel = '编辑',
  emptyDisplayText = '（未命名）',
  minTrimmedLengthToCommit = 1,
}: EditablePageTitleProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    if (!editing) return;
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [editing]);

  const titleTypography = 'text-2xl font-semibold tracking-tight md:text-3xl';

  const measureTypography = cn(
    'col-start-1 row-start-1 whitespace-pre px-0 py-0.5',
    titleTypography,
    'pointer-events-none select-none',
  );

  const displayText = useMemo(() => {
    const t = value.trim();
    return t !== '' ? value : emptyDisplayText;
  }, [emptyDisplayText, value]);

  const commit = () => {
    const t = draft.trim();
    if (t.length < minTrimmedLengthToCommit) {
      setDraft(value);
      setEditing(false);
      return;
    }
    if (t !== value) onChange(t);
    setEditing(false);
  };

  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  if (editing) {
    const measureText = draft.length > 0 ? draft : '\u00a0';
    return (
      <span className="inline-flex w-max max-w-full min-w-0 items-center gap-0.5">
        <span className={cn('inline-grid min-w-40 max-w-full grid-cols-1', 'w-[min(100%,max-content)]')}>
          <span className={cn(measureTypography, 'invisible')} aria-hidden>
            {measureText}
          </span>
          <Input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => commit()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commit();
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                cancel();
              }
            }}
            className={cn(
              'col-start-1 row-start-1 h-auto min-h-0 w-full min-w-0 max-w-full',
              'border-0 border-b border-transparent bg-transparent px-0 py-0.5 shadow-none',
              titleTypography,
              'rounded-none focus-visible:border-primary focus-visible:ring-0',
            )}
            aria-label={inputAriaLabel}
          />
        </span>
      </span>
    );
  }

  return (
    <span className="inline-flex w-max max-w-full min-w-0 items-center gap-0.5">
      <span className="min-w-0 truncate">{displayText}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        aria-label={editButtonAriaLabel}
      >
        <Pencil className="size-4" aria-hidden />
      </Button>
    </span>
  );
}
