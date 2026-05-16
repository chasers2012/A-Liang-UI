'use client';

import { ChevronDownIcon } from 'lucide-react';
import { useMemo, useState } from 'react';

import { CronAdvancedFiveFields, mergePartsForPreset } from '@/components/cron-field/cron-advanced-five-fields';
import {
  type CronFieldModel,
  type CronPresetMode,
  parseCronExpression,
  serializeCronExpression,
} from '@/components/cron-field/cron-expr';
import { formatCronReadableSummary } from '@/components/cron-field/cron-readable';
import {
  defaultSegmentParts,
  isCronPresetSimpleGlyphs,
  joinCronParts,
  splitCronExpression,
} from '@/components/cron-field/cron-field-segments';
import { buttonVariants } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Field, FieldLabel } from '@/components/ui/field';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

/** 从左到右的 Tab 顺序 */
const PRESET_ORDER: readonly CronPresetMode[] = [
  'every_minute',
  'every_hour',
  'daily',
  'weekly',
  'monthly_day',
  'monthly_week',
  'advanced',
];

const PRESET_ITEMS: Record<CronPresetMode, string> = {
  every_minute: '每分钟',
  every_hour: '每小时',
  daily: '每天',
  weekly: '每周',
  monthly_day: '每月某日',
  monthly_week: '每月某周',
  advanced: '自定义',
};

export type CronFieldProps = {
  value: string;
  onValueChange: (next: string) => void;
  readOnly?: boolean;
  className?: string;
  id?: string;
  ariaLabelledBy?: string;
};

function carryMinutes(prev: CronFieldModel): number[] {
  return prev.minutes.length ? prev.minutes : [0];
}

function carryHours(prev: CronFieldModel): number[] {
  return prev.hours.length ? prev.hours : [0];
}

function defaultsForPresetEveryMinute(): CronFieldModel {
  return { preset: 'every_minute', minutes: [], hours: [], daysOfMonth: [1], daysOfWeek: [0] };
}

function defaultsForPresetEveryHour(prev: CronFieldModel, ignoreCarry: boolean): CronFieldModel {
  return {
    preset: 'every_hour',
    minutes: ignoreCarry ? [0] : carryMinutes(prev),
    hours: [],
    daysOfMonth: [1],
    daysOfWeek: [0],
  };
}

function defaultsForPresetDaily(prev: CronFieldModel, ignoreCarry: boolean): CronFieldModel {
  return {
    preset: 'daily',
    minutes: ignoreCarry ? [0] : carryMinutes(prev),
    hours: ignoreCarry ? [0] : carryHours(prev),
    daysOfMonth: [1],
    daysOfWeek: [0],
  };
}

function defaultsForPresetWeekly(prev: CronFieldModel, ignoreCarry: boolean): CronFieldModel {
  return {
    preset: 'weekly',
    minutes: ignoreCarry ? [0] : carryMinutes(prev),
    hours: ignoreCarry ? [0] : carryHours(prev),
    daysOfMonth: [1],
    daysOfWeek: ignoreCarry ? [1] : prev.daysOfWeek.length ? prev.daysOfWeek : [1],
  };
}

function defaultsForPresetMonthlyDay(prev: CronFieldModel, ignoreCarry: boolean): CronFieldModel {
  return {
    preset: 'monthly_day',
    minutes: ignoreCarry ? [0] : carryMinutes(prev),
    hours: ignoreCarry ? [0] : carryHours(prev),
    daysOfMonth: ignoreCarry ? [1] : prev.daysOfMonth.length ? prev.daysOfMonth : [1],
    daysOfWeek: [0],
  };
}

function defaultsForPresetMonthlyWeek(prev: CronFieldModel, ignoreCarry: boolean): CronFieldModel {
  return {
    preset: 'monthly_week',
    minutes: ignoreCarry ? [0] : carryMinutes(prev),
    hours: ignoreCarry ? [0] : carryHours(prev),
    daysOfMonth: [1],
    daysOfWeek: ignoreCarry ? [1] : prev.daysOfWeek.length ? prev.daysOfWeek : [1],
    nthOfMonth: ignoreCarry ? 1 : (prev.nthOfMonth ?? 1),
  };
}

function defaultsForPreset(preset: CronPresetMode, prev: CronFieldModel, ignoreCarry: boolean): CronFieldModel {
  switch (preset) {
    case 'every_minute':
      return defaultsForPresetEveryMinute();
    case 'every_hour':
      return defaultsForPresetEveryHour(prev, ignoreCarry);
    case 'daily':
      return defaultsForPresetDaily(prev, ignoreCarry);
    case 'weekly':
      return defaultsForPresetWeekly(prev, ignoreCarry);
    case 'monthly_day':
      return defaultsForPresetMonthlyDay(prev, ignoreCarry);
    case 'monthly_week':
      return defaultsForPresetMonthlyWeek(prev, ignoreCarry);
    default:
      return { ...prev, preset: 'advanced' };
  }
}

type CronScheduleEditorInnerProps = {
  value: string;
  readOnly: boolean;
  parsed: CronFieldModel;
  uiPreset: CronPresetMode;
  setUiPreset: (preset: CronPresetMode) => void;
  commitSimplePresetFromModel: (next: CronFieldModel) => void;
  normalizeValueForAdvanced: () => void;
  onValueChange: (next: string) => void;
};

function CronScheduleEditorInner(props: CronScheduleEditorInnerProps) {
  const {
    value,
    readOnly,
    parsed,
    uiPreset,
    setUiPreset,
    commitSimplePresetFromModel,
    normalizeValueForAdvanced,
    onValueChange,
  } = props;

  const onPresetChange = (preset: CronPresetMode) => {
    if (readOnly) return;
    setUiPreset(preset);
    if (preset === 'advanced') {
      normalizeValueForAdvanced();
      return;
    }
    const ignoreCarry = parsed.preset === 'advanced' && Boolean(value.trim()) && !isCronPresetSimpleGlyphs(value);
    commitSimplePresetFromModel(defaultsForPreset(preset, parsed, ignoreCarry));
  };

  return (
    <div className="flex flex-col gap-3">
      <Field className="min-w-0 w-full gap-1.5">
        <FieldLabel className="text-xs font-normal text-muted-foreground">调度类型</FieldLabel>
        <Tabs
          value={uiPreset}
          onValueChange={(v) => {
            if (v == null) return;
            onPresetChange(v as CronPresetMode);
          }}
          className="w-full items-start gap-0"
        >
          <TabsList className="inline-flex h-auto w-fit max-w-full flex-wrap gap-1 rounded-lg bg-muted/80 p-1 text-muted-foreground">
            {PRESET_ORDER.map((key) => (
              <TabsTrigger key={key} value={key} disabled={readOnly} className="flex-none px-2 py-1 text-xs">
                {PRESET_ITEMS[key]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </Field>

      <CronAdvancedFiveFields value={value} preset={uiPreset} readOnly={readOnly} onValueChange={onValueChange} />
    </div>
  );
}

export function CronField(props: CronFieldProps) {
  const { value, onValueChange, readOnly = false, className, id, ariaLabelledBy } = props;

  const parsed = useMemo(() => parseCronExpression(value), [value]);
  /** 调度类型仅以用户手动切 Tab 为准，不从表达式反推（避免步进等非列举式改写后自动跳到「自定义」） */
  const [uiPreset, setUiPreset] = useState<CronPresetMode>(() => parseCronExpression(value).preset);

  const [expanded, setExpanded] = useState(false);
  const summary = useMemo(() => formatCronReadableSummary(value), [value]);
  const isUnset = summary === '未设置调度';

  const commitSimplePresetFromModel = (next: CronFieldModel) => {
    if (next.preset === 'advanced') return;
    onValueChange(serializeCronExpression(next));
  };

  const normalizeValueForAdvanced = () => {
    const trimmed = value.trim();
    if (!trimmed) {
      onValueChange(joinCronParts(mergePartsForPreset('advanced', defaultSegmentParts())));
      return;
    }
    const raw = splitCronExpression(trimmed);
    if (!raw || raw.length !== 5) return;
    const tuple = [raw[0] ?? '*', raw[1] ?? '*', raw[2] ?? '*', raw[3] ?? '*', raw[4] ?? '*'] as [
      string,
      string,
      string,
      string,
      string,
    ];
    onValueChange(joinCronParts(mergePartsForPreset('advanced', tuple)));
  };

  if (readOnly) {
    return (
      <div role="group" aria-labelledby={ariaLabelledBy} className={cn('flex min-w-0 flex-col gap-3', className)}>
        <button
          id={id}
          type="button"
          data-slot="cron-field-readonly"
          data-readonly=""
          data-size="sm"
          data-empty={isUnset ? '' : undefined}
          className="inline-flex w-full min-w-0 cursor-default items-center gap-2 text-left font-normal select-none"
        >
          <span className="min-w-0 flex-1 truncate">{summary}</span>
        </button>
      </div>
    );
  }

  return (
    <div role="group" aria-labelledby={ariaLabelledBy} className={cn('flex min-w-0 flex-col gap-3', className)}>
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <CollapsibleTrigger
          id={id}
          type="button"
          data-empty={isUnset ? 'true' : undefined}
          className={cn(
            buttonVariants({ variant: 'outline', size: 'sm' }),
            'h-8 w-full justify-between gap-2 px-2.5 font-normal data-empty:text-muted-foreground',
          )}
          aria-expanded={expanded}
        >
          <span className="min-w-0 flex-1 truncate text-left text-sm">{summary}</span>
          <ChevronDownIcon
            className={cn(
              'size-3.5 shrink-0 text-muted-foreground opacity-70 transition-transform',
              expanded ? 'rotate-180' : undefined,
            )}
            aria-hidden
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="flex flex-col gap-3 rounded-lg border border-border/80 bg-muted/15 p-3 pt-3">
          <CronScheduleEditorInner
            value={value}
            readOnly={false}
            parsed={parsed}
            uiPreset={uiPreset}
            setUiPreset={setUiPreset}
            commitSimplePresetFromModel={commitSimplePresetFromModel}
            normalizeValueForAdvanced={normalizeValueForAdvanced}
            onValueChange={onValueChange}
          />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
