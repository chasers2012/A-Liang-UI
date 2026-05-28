'use client';

import { useMemo } from 'react';

import type { CronPresetMode } from '@/components/cron-field/cron-expr';
import { CronSegmentPopoverField } from '@/components/cron-field/cron-segment-popover-field';
import type { CronDowPopoverLayout, CronFieldSegmentKind } from '@/components/cron-field/cron-field-segments';
import { defaultSegmentParts, joinCronParts, splitCronExpression } from '@/components/cron-field/cron-field-segments';
import { Field, FieldLabel } from '@/components/ui/field';
import { cn } from '@/lib/utils';

const KIND_INDEX: Record<CronFieldSegmentKind, number> = {
  minute: 0,
  hour: 1,
  dom: 2,
  month: 3,
  dow: 4,
};

const SEGMENTS: Record<CronFieldSegmentKind, { label: string }> = {
  minute: { label: '分' },
  hour: { label: '时' },
  dom: { label: '日' },
  month: { label: '月' },
  dow: { label: '周' },
};

/** 与各预设单列默认值对齐（cron-field.tsx），用于指定 Tab 首轮点选时用新值换掉占位 */
export function cronImplicitSingletonPickPivot(preset: CronPresetMode, kind: CronFieldSegmentKind): number | undefined {
  switch (kind) {
    case 'minute':
    case 'hour':
      return 0;
    case 'dom':
      if (preset === 'monthly_day' || preset === 'advanced') return 1;
      return undefined;
    case 'dow':
      if (preset === 'weekly' || preset === 'advanced') return 1;
      return undefined;
    case 'month':
      return preset === 'advanced' ? 1 : undefined;
    default:
      return undefined;
  }
}

/** 每种调度类型需要编辑的片段；顺序为粗粒度→细（月预设下：按日时为日→时分，按周时为周→时分） */
const VISIBLE_KINDS: Record<CronPresetMode, readonly CronFieldSegmentKind[]> = {
  every_minute: [],
  every_hour: ['minute'],
  daily: ['hour', 'minute'],
  weekly: ['dow', 'hour', 'minute'],
  monthly_day: ['dom', 'hour', 'minute'],
  monthly_week: ['dow', 'hour', 'minute'],
  advanced: ['month', 'dow', 'dom', 'hour', 'minute'],
};

export function mergePartsForPreset(
  preset: CronPresetMode,
  parts: readonly [string, string, string, string, string],
): [string, string, string, string, string] {
  const [m, h, d, mo, w] = parts;
  switch (preset) {
    case 'every_minute':
      return ['*', '*', '*', '*', '*'];
    case 'every_hour': {
      const token = !m.trim() || m.trim() === '*' ? '0' : m.trim();
      return [token, '*', '*', '*', '*'];
    }
    case 'daily':
      return [m, h, '*', '*', '*'];
    case 'weekly':
      return [m, h, '*', '*', w];
    case 'monthly_day':
      return [m, h, d, '*', '*'];
    case 'monthly_week':
      return [m, h, '?', '*', w];
    case 'advanced':
    default:
      return [m, h, d, mo, w];
  }
}

export type CronAdvancedFiveFieldsProps = {
  value: string;
  preset: CronPresetMode;
  onValueChange: (next: string) => void;
  readOnly?: boolean;
};

export function CronAdvancedFiveFields(props: CronAdvancedFiveFieldsProps) {
  const { value, preset, onValueChange, readOnly = false } = props;

  const partsTuple = useMemo((): [string, string, string, string, string] => {
    const p = splitCronExpression(value);
    if (!p) return defaultSegmentParts();
    return [p[0] ?? '*', p[1] ?? '*', p[2] ?? '*', p[3] ?? '*', p[4] ?? '*'];
  }, [value]);

  const visibleKinds = VISIBLE_KINDS[preset];

  const commitPart = (index: number, next: string) => {
    const base = [...partsTuple] as [string, string, string, string, string];
    base[index] = next.trim() || '*';
    onValueChange(joinCronParts(mergePartsForPreset(preset, base)));
  };

  const gridCols =
    visibleKinds.length >= 5
      ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-5'
      : visibleKinds.length === 3
        ? 'grid-cols-1 sm:grid-cols-3'
        : visibleKinds.length === 2
          ? 'grid-cols-1 sm:grid-cols-2'
          : visibleKinds.length === 1
            ? 'grid-cols-1'
            : '';

  return (
    <div className={cn('flex flex-col', visibleKinds.length ? 'gap-3' : '')}>
      {visibleKinds.length ? (
        <div className={cn('grid gap-3', gridCols)}>
          {visibleKinds.map((kind) => {
            const idx = KIND_INDEX[kind];
            const s = SEGMENTS[kind];
            const dowPopoverLayout: CronDowPopoverLayout | undefined =
              kind === 'dow'
                ? preset === 'weekly'
                  ? 'preset_weekly'
                  : preset === 'monthly_week'
                    ? 'preset_monthly_nth'
                    : 'default'
                : undefined;
            return (
              <Field key={kind} className="min-w-0 gap-1.5">
                <FieldLabel className="text-xs font-normal text-muted-foreground">{s.label}</FieldLabel>
                <CronSegmentPopoverField
                  id={`cron-segment-${kind}-${preset}`}
                  segmentKind={kind}
                  dowPopoverLayout={dowPopoverLayout}
                  implicitSingletonDefaultPivot={cronImplicitSingletonPickPivot(preset, kind)}
                  size="sm"
                  value={partsTuple[idx]}
                  readOnly={readOnly}
                  onValueChange={(next) => commitPart(idx, next)}
                />
              </Field>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
