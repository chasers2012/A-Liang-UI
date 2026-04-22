'use client';

import { useEffect, useMemo, useState } from 'react';

import { cn } from '@/lib/utils';
import { listFactors } from '@/api/factors';

import { parseDependencies } from '@/models/factor';
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from '@/components/ui/combobox';

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

const chipClass = cn('font-mono text-xs');

const inputClass = cn('font-mono text-sm placeholder:text-muted-foreground');

const itemClass = cn('items-start font-mono text-sm');

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
  const anchor = useComboboxAnchor();

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
      <Combobox
        items={items}
        multiple
        value={selected}
        onValueChange={handleValueChange}
        inputValue={inputValue}
        onInputValueChange={setInputValue}
        openOnInputClick
      >
        <ComboboxChips ref={anchor} className="w-full min-w-0">
          <ComboboxValue>
            {(value: string[]) => (
              <>
                {value.map((dep) => (
                  <ComboboxChip key={dep} className={chipClass} aria-label={`移除 ${dep}`}>
                    {dep}
                  </ComboboxChip>
                ))}
                <ComboboxChipsInput
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
          </ComboboxValue>
        </ComboboxChips>

        <ComboboxContent
          anchor={anchor}
          sideOffset={4}
          align="start"
          className="w-max max-w-[min(28rem,var(--available-width))]"
        >
          <ComboboxEmpty className="px-2.5 py-2 text-sm text-muted-foreground">
            无匹配项。输入合法列名（字母/数字/下划线）后按 Enter 添加。
          </ComboboxEmpty>
          <ComboboxList className="outline-none">
            {(item: string) => (
              <ComboboxItem key={item} value={item} className={itemClass}>
                <span className="min-w-0 flex-1 whitespace-normal wrap-break-word">{item}</span>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  );
}
