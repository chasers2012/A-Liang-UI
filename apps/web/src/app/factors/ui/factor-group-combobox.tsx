'use client';

import { useEffect, useMemo, useState } from 'react';

import { cn } from '@/lib/utils';
import { listFactors } from '@/api/factors';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox';

const itemClassName = cn('font-mono text-sm whitespace-normal wrap-break-word');

export interface FactorGroupComboboxProps {
  id: string;
  value: string;
  onValueChange: (group: string) => void;
  className?: string;
}

export function FactorGroupCombobox({ id, value, onValueChange, className }: FactorGroupComboboxProps) {
  const [knownGroups, setKnownGroups] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState(value);

  useEffect(() => {
    let cancelled = false;
    void listFactors()
      .then((rows) => {
        if (cancelled) return;
        const next = new Set<string>();
        for (const r of rows) {
          const g = r.group?.trim();
          if (g) next.add(g);
        }
        setKnownGroups([...next].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN')));
      })
      .catch(() => {
        if (!cancelled) setKnownGroups([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const items = useMemo(() => knownGroups, [knownGroups]);

  return (
    <Combobox
      items={items}
      value={value}
      onValueChange={(next) => {
        const v = next ?? '';
        setInputValue(v);
        onValueChange(v);
      }}
      inputValue={inputValue}
      onInputValueChange={(next) => {
        setInputValue(next);
        onValueChange(next);
      }}
      openOnInputClick
    >
      <ComboboxInput
        id={id}
        placeholder="未分组"
        autoComplete="off"
        className={cn('w-full font-mono', className)}
        showTrigger
      />

      <ComboboxContent sideOffset={4} align="start" className="w-max max-w-[min(28rem,var(--available-width))]">
        <ComboboxEmpty className="px-2.5 py-2 text-sm text-muted-foreground">
          无匹配分组。可直接输入新名称，保存后作为新分组。
        </ComboboxEmpty>
        <ComboboxList className="outline-none">
          {(group: string) => (
            <ComboboxItem key={group} value={group} className={itemClassName}>
              {group}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
