'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { WidgetProps } from '@rjsf/utils';
import { useCallback, useMemo } from 'react';

type RjsfProjectFormContext = Record<string, unknown> & { __rjsfProjectReadonly?: boolean };

function isEnumValueMatched(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (left == null || right == null) return false;
  if (typeof left === 'object' || typeof right === 'object') return false;
  return String(left) === String(right);
}

function isUnset(value: unknown, emptyValue: unknown): boolean {
  if (value === undefined) return true;
  return Object.is(value, emptyValue);
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

  const { selectedValues, multiSummary, selectedLabel } = useMemo(() => {
    const opts = Array.isArray(options.enumOptions) ? options.enumOptions : [];

    let selectedValues: unknown | unknown[] | null;
    if (multiple) {
      const arr = Array.isArray(value) ? (value as unknown[]) : [];
      selectedValues = arr
        .map((v) => opts.find((o) => isEnumValueMatched(o.value, v))?.value)
        .filter((v) => v !== undefined);
    } else if (isUnset(value, options.emptyValue)) {
      selectedValues = null;
    } else {
      const found = opts.find((o) => isEnumValueMatched(o.value, value));
      selectedValues = found ? found.value : value;
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
  }, [multiple, options.emptyValue, options.enumOptions, value]);

  const onValueChange = useCallback(
    (next: unknown) => {
      if (multiple) {
        const arr = Array.isArray(next) ? next : [];
        onChange(arr);
        return;
      }
      if (next == null) {
        onChange(options.emptyValue);
        return;
      }
      onChange(next);
    },
    [multiple, onChange, options],
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

  return (
    <Select
      multiple={multiple}
      value={selectedValues as never}
      isItemEqualToValue={(a, b) => {
        if (a == null && b == null) return true;
        if (a == null || b == null) return false;
        return isEnumValueMatched(a, b);
      }}
      disabled={disabled || isReadonly}
      required={required}
      onValueChange={onValueChange}
      onOpenChange={onOpenChange}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={placeholder}>{multiple ? multiSummary : selectedLabel}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {!multiple && !required ? (
          <SelectItem value={null as never} label={typeof placeholder === 'string' ? placeholder : undefined}>
            {placeholder}
          </SelectItem>
        ) : null}
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
