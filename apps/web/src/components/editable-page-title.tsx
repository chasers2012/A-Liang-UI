'use client';

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface EditablePageTitleProps {
  value: string;
  showEdit?: boolean;

  onChange: (value: string) => void;
  /** 输入框的无障碍名称，默认「名称」 */
  inputAriaLabel?: string;
  /** 编辑按钮的无障碍名称，默认「编辑」 */
  editButtonAriaLabel?: string;
  /** 展示态为空时的占位文本，默认「（未命名）」 */
  placeholder?: string;
  /** 输入态可提交的最小长度，默认 1（trim 后） */
  minTrimmedLengthToCommit?: number;
}

export function EditablePageTitle({
  value,
  onChange,
  showEdit = true,
  inputAriaLabel = '名称',
  editButtonAriaLabel = '编辑',
  placeholder = '（未命名）',
  minTrimmedLengthToCommit = 1,
}: EditablePageTitleProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [inputWidth, setInputWidth] = useState<number>();

  useLayoutEffect(() => {
    if (!editing) return;
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [editing]);

  useLayoutEffect(() => {
    if (!editing) return;
    const el = measureRef.current;
    if (!el) return;
    // +2 给光标/抗锯齿留点余量，避免偶发换行/抖动
    const w = Math.ceil(el.getBoundingClientRect().width) + 2;
    setInputWidth(w);
  }, [draft, editing]);

  const displayText = useMemo(() => {
    const t = value.trim();
    return t !== '' ? value : placeholder;
  }, [placeholder, value]);

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

  return (
    <span className="inline-flex w-max max-w-full min-w-0 items-center gap-0.5">
      <span className="min-w-0 truncate">
        {!editing ? (
          displayText
        ) : (
          <span className="relative inline-block max-w-full min-w-0">
            <span
              ref={measureRef}
              className={cn(
                'pointer-events-none absolute -z-10 opacity-0',
                'whitespace-pre text-base md:text-sm font-inherit text-inherit',
              )}
              aria-hidden
            >
              {draft === '' ? ' ' : draft}
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
              style={inputWidth ? { width: inputWidth } : undefined}
              className={cn(
                'h-auto min-h-0 w-auto min-w-0 max-w-full',
                'border-0 bg-transparent px-0 py-0 shadow-none',
                'rounded-md focus-visible:ring-0',
              )}
              aria-label={inputAriaLabel}
            />
          </span>
        )}
      </span>

      {showEdit && !editing && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="ml-2 size-5 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={() => {
            setDraft(value);
            setEditing(true);
          }}
          aria-label={editButtonAriaLabel}
        >
          <Pencil className="size-4" aria-hidden />
        </Button>
      )}
    </span>
  );
}
