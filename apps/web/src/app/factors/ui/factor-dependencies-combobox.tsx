'use client';

import { useEffect, useMemo, useState } from 'react';
import { Combobox } from '@base-ui/react/combobox';
import { Check, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { listFactors } from '@/api/factors';

import { parseDependencies } from '@/models/factor';

const BASE_SUGGESTIONS: readonly string[] = [
  'open',
  'high',
  'low',
  'close',
  'volume',
  'vwap',
  'amount',
  'turnover',
  'returns',
  'pct_chg',
];

function isValidDepToken(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(t);
}

const inputGroupClass = cn(
  'flex min-h-8 w-full flex-wrap items-center gap-0.5 rounded-lg border border-input bg-transparent px-1.5 py-1',
  'outline-none transition-colors',
  'focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50',
  'dark:bg-input/30',
);

const chipClass = cn(
  'flex items-center gap-0.5 rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground',
  'outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground',
);

const inputClass = cn(
  'min-w-[6rem] flex-1 border-0 bg-transparent py-0.5 pl-1 font-mono text-sm outline-none',
  'placeholder:text-muted-foreground',
);

const itemClass = cn(
  'flex cursor-default items-start gap-2 px-2.5 py-1.5 font-mono text-sm outline-none select-none',
  'data-[highlighted]:relative data-[highlighted]:z-0 data-[highlighted]:text-accent-foreground',
  'data-[highlighted]:before:absolute data-[highlighted]:before:inset-x-1 data-[highlighted]:before:inset-y-0.5 data-[highlighted]:before:z-[-1]',
  'data-[highlighted]:before:rounded-md data-[highlighted]:before:bg-accent',
);

export interface FactorDependenciesComboboxProps {
  id: string;
  /** 逗号 / 中文逗号分隔，与 `FactorFormState.dependencies_csv` 一致 */
  valueCsv: string;
  onValueCsvChange: (csv: string) => void;
  className?: string;
}

export function FactorDependenciesCombobox({
  id,
  valueCsv,
  onValueCsvChange,
  className,
}: FactorDependenciesComboboxProps) {
  const selected = useMemo(() => parseDependencies(valueCsv), [valueCsv]);
  const [pool, setPool] = useState<string[]>([...BASE_SUGGESTIONS]);
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    let cancelled = false;
    void listFactors()
      .then((rows) => {
        if (cancelled) return;
        const next = new Set<string>(BASE_SUGGESTIONS);
        for (const r of rows) {
          for (const d of r.dependencies) {
            const t = d.trim();
            if (t) next.add(t);
          }
        }
        setPool([...next].sort((a, b) => a.localeCompare(b, 'en')));
      })
      .catch(() => {
        if (!cancelled) setPool([...BASE_SUGGESTIONS]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const items = useMemo(() => {
    const s = new Set(pool);
    for (const d of selected) s.add(d);
    return [...s].sort((a, b) => a.localeCompare(b, 'en'));
  }, [pool, selected]);

  const setSelected = (next: string[]) => {
    const seen = new Set<string>();
    const unique = next.filter((x) => {
      const t = x.trim();
      if (!t || seen.has(t)) return false;
      seen.add(t);
      return true;
    });
    onValueCsvChange(unique.join(', '));
  };

  const handleValueChange = (next: string[] | null) => {
    setSelected(next ?? []);
  };

  const tryAddFromInput = () => {
    const t = inputValue.trim();
    if (!t || !isValidDepToken(t)) return false;
    if (selected.includes(t)) {
      setInputValue('');
      return true;
    }
    setSelected([...selected, t]);
    setInputValue('');
    return true;
  };

  return (
    <div className={className}>
      <Combobox.Root
        items={items}
        multiple
        value={selected}
        onValueChange={handleValueChange}
        inputValue={inputValue}
        onInputValueChange={setInputValue}
        openOnInputClick
      >
        <Combobox.InputGroup className={inputGroupClass}>
          <Combobox.Chips className="flex w-full min-w-0 flex-wrap items-center gap-0.5">
            <Combobox.Value>
              {(value: string[]) => (
                <>
                  {value.map((dep) => (
                    <Combobox.Chip key={dep} className={chipClass} aria-label={`移除 ${dep}`}>
                      {dep}
                      <Combobox.ChipRemove
                        type="button"
                        className="rounded p-0.5 text-muted-foreground hover:bg-background/80 hover:text-foreground"
                        aria-label="移除"
                      >
                        <X className="size-3" aria-hidden />
                      </Combobox.ChipRemove>
                    </Combobox.Chip>
                  ))}
                  <Combobox.Input
                    id={id}
                    placeholder={value.length > 0 ? '添加更多…' : '如 close、volume'}
                    className={inputClass}
                    autoComplete="off"
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return;
                      if (tryAddFromInput()) e.preventDefault();
                    }}
                  />
                </>
              )}
            </Combobox.Value>
          </Combobox.Chips>
        </Combobox.InputGroup>

        <Combobox.Portal>
          <Combobox.Positioner className="z-50 outline-none" sideOffset={4} align="start">
            <Combobox.Popup
              className={cn(
                'max-h-[min(16rem,var(--available-height))] min-w-[var(--anchor-width)] w-max max-w-[min(28rem,var(--available-width))]',
                'origin-[var(--transform-origin)] overflow-y-auto overscroll-contain rounded-md border border-border bg-popover py-1 text-popover-foreground shadow-md',
              )}
            >
              <Combobox.Empty className="px-2.5 py-2 text-sm text-muted-foreground">
                无匹配项。输入合法列名（字母/数字/下划线）后按 Enter 添加。
              </Combobox.Empty>
              <Combobox.List className="outline-none">
                {(item: string) => (
                  <Combobox.Item key={item} value={item} className={itemClass}>
                    <Combobox.ItemIndicator className="mt-0.5 flex shrink-0 justify-center">
                      <Check className="size-3.5" aria-hidden />
                    </Combobox.ItemIndicator>
                    <span className="min-w-0 flex-1 whitespace-normal wrap-break-word">{item}</span>
                  </Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    </div>
  );
}
