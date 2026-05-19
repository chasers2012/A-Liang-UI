'use client';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { WidgetProps } from '@rjsf/utils';
import { XIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, type MouseEvent } from 'react';

type RjsfProjectFormContext = Record<string, unknown> & { __rjsfProjectReadonly?: boolean };

function isEnumValueMatched(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (left == null || right == null) return false;
  if (typeof left === 'object' || typeof right === 'object') return false;
  return String(left) === String(right);
}

function isUnset(value: unknown, emptyValue: unknown): boolean {
  if (Object.is(value, emptyValue)) return true;
  return value == null && emptyValue == null;
}

type EnumOption = { value: unknown; label?: string };

function resolveValuesInOptions(values: unknown[], opts: EnumOption[]): unknown[] {
  return values.map((v) => opts.find((o) => isEnumValueMatched(o.value, v))?.value).filter((v) => v !== undefined);
}

function hasValueOutsideOptions(value: unknown, opts: EnumOption[], multiple: boolean, emptyValue: unknown): boolean {
  if (multiple) {
    const arr = Array.isArray(value) ? value : [];
    return arr.some((v) => !opts.some((o) => isEnumValueMatched(o.value, v)));
  }
  if (isUnset(value, emptyValue)) return false;
  return !opts.some((o) => isEnumValueMatched(o.value, value));
}

export function RjsfPortalSelectWidget(props: WidgetProps) {
  const {
    id,
    multiple,
    onChange,
    onBlur,
    onFocus,
    options,
    value,
    disabled,
    readonly,
    required,
    placeholder,
    formContext,
  } = props;
  const forcedReadonly = Boolean((formContext as RjsfProjectFormContext | undefined)?.__rjsfProjectReadonly);
  const isReadonly = readonly || forcedReadonly;
  const { emptyValue } = options;

  const { selectedValues, multiSummary, selectedLabel } = useMemo(() => {
    const opts = Array.isArray(options.enumOptions) ? options.enumOptions : [];

    let selectedValues: unknown | unknown[] | null;
    if (multiple) {
      const arr = Array.isArray(value) ? (value as unknown[]) : [];
      selectedValues = arr
        .map((v) => opts.find((o) => isEnumValueMatched(o.value, v))?.value)
        .filter((v) => v !== undefined);
    } else if (isUnset(value, emptyValue)) {
      selectedValues = null;
    } else {
      const found = opts.find((o) => isEnumValueMatched(o.value, value));
      selectedValues = found ? found.value : null;
    }

    let multiSummary: string | undefined;
    if (multiple && Array.isArray(selectedValues)) {
      const labels = selectedValues
        .map((v) => opts.find((o) => isEnumValueMatched(o.value, v))?.label)
        .filter((label): label is string => typeof label === 'string' && label.length > 0);
      multiSummary = labels.length ? labels.join('，') : undefined;
    } else {
      multiSummary = undefined;
    }

    let selectedLabel: string | undefined;
    if (!multiple && selectedValues != null) {
      selectedLabel = opts.find((o) => isEnumValueMatched(o.value, selectedValues))?.label as string | undefined;
    } else {
      selectedLabel = undefined;
    }

    return { selectedValues, multiSummary, selectedLabel };
  }, [emptyValue, multiple, options.enumOptions, value]);

  useEffect(() => {
    const opts = Array.isArray(options.enumOptions) ? options.enumOptions : [];
    if (!hasValueOutsideOptions(value, opts, Boolean(multiple), options.emptyValue)) return;

    if (multiple) {
      const arr = Array.isArray(value) ? value : [];
      onChange(resolveValuesInOptions(arr, opts));
      return;
    }
    if (required && opts.length > 0) {
      onChange(opts[0].value);
      return;
    }
    onChange(options.emptyValue);
  }, [multiple, onChange, options.emptyValue, options.enumOptions, required, value]);

  const onValueChange = useCallback(
    (next: unknown) => {
      if (isReadonly) return;
      if (multiple) {
        const arr = Array.isArray(next) ? next : [];
        onChange(arr);
        return;
      }
      if (next == null) {
        onChange(emptyValue);
        return;
      }
      onChange(next);
    },
    [emptyValue, isReadonly, multiple, onChange],
  );

  const onOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        onBlur?.(id, value);
        return;
      }
      onFocus?.(id, value);
    },
    [onBlur, onFocus, id, value],
  );

  const showClear = !multiple && !required && !disabled && !isReadonly && !isUnset(value, emptyValue);

  const onClear = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (isReadonly) return;
      onChange(emptyValue);
    },
    [emptyValue, isReadonly, onChange],
  );

  return (
    <Select
      multiple={multiple}
      value={selectedValues as never}
      isItemEqualToValue={(a, b) => {
        if (a == null && b == null) return true;
        if (a == null || b == null) return false;
        return isEnumValueMatched(a, b);
      }}
      disabled={disabled}
      readOnly={isReadonly}
      required={required}
      onValueChange={onValueChange}
      onOpenChange={onOpenChange}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={placeholder}>{multiple ? multiSummary : selectedLabel}</SelectValue>
        {showClear ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="清空"
            className="pointer-events-auto -mr-1 shrink-0"
            onClick={onClear}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <XIcon className="size-3.5" />
          </Button>
        ) : null}
      </SelectTrigger>
      <SelectContent>
        {(Array.isArray(options.enumOptions) ? options.enumOptions : []).map((option, index) => (
          <SelectItem
            key={`${id}-${String(option.value)}-${index}`}
            value={option.value as never}
            label={typeof option.label === 'string' ? option.label : undefined}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
