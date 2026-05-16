'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDownIcon } from 'lucide-react';

import type { CronDowPopoverLayout } from '@/components/cron-field/cron-field-segments';
import {
  type CronFieldSegmentKind,
  type ParsedCronSegment,
  boundsForCronSegmentKind,
  expandedSegmentPickValues,
  formatDowSegmentSummary,
  parseCronSegmentToken,
  serializeCronSegment,
  serializeSegmentPickToken,
} from '@/components/cron-field/cron-field-segments';
import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

const DOW_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

type EditorTab = 'every' | 'pick' | 'step' | 'lastDom' | 'nth';

type DowWeeklyTab = 'every' | 'pick' | 'step';

/** 与日历时「日」格子一致：ghost + 选中为 primary */
function SegmentPickButton(props: {
  readOnly: boolean;
  pressed: boolean;
  className?: string;
  ariaLabel?: string;
  children: React.ReactNode;
  onPick: () => void;
}) {
  const { readOnly, pressed, className, ariaLabel, children, onPick } = props;
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={cn(
        'shrink-0 p-0 font-mono text-[0.6875rem] leading-none font-normal shadow-none',
        'focus-visible:z-10 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
        pressed
          ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground dark:hover:bg-primary/90 dark:hover:text-primary-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        className,
      )}
      disabled={readOnly}
      aria-label={ariaLabel}
      aria-pressed={pressed}
      onClick={onPick}
    >
      {children}
    </Button>
  );
}

function NumericButtonGrid(props: {
  ids: readonly string[];
  readOnly: boolean;
  formatLabel: (n: number) => string;
  isSelected: (n: number) => boolean;
  onPick: (n: number) => void;
}) {
  const { ids, readOnly, formatLabel, isSelected, onPick } = props;
  return (
    <div className="-mx-0.5 px-0.5">
      <div role="grid" className="grid w-max max-w-full grid-cols-[repeat(6,auto)] gap-1 rounded-md">
        {ids.map((id) => {
          const n = Number(id);
          return (
            <SegmentPickButton
              key={id}
              readOnly={readOnly}
              pressed={isSelected(n)}
              ariaLabel={formatLabel(n)}
              onPick={() => onPick(n)}
            >
              {formatLabel(n)}
            </SegmentPickButton>
          );
        })}
      </div>
    </div>
  );
}

function PickToggleGrid(props: {
  ids: readonly string[];
  readOnly: boolean;
  fallbackWhenEmpty: number;
  /** 与 presets 单列默认值一致时点选其它格子则替换为该列，否则会与默认并排多选（如「周」默认为周一 而非 domain min） */
  implicitSingletonDefaultPivot?: number;
  selected: readonly number[];
  kind: CronFieldSegmentKind;
  onCommit: (next: number[]) => void;
}) {
  const { ids, readOnly, fallbackWhenEmpty, implicitSingletonDefaultPivot, selected, kind, onCommit } = props;
  const set = new Set(selected);

  const labelFor = (n: number) => (kind === 'dow' ? (DOW_LABELS[n] ?? `星期${n}`) : String(n));

  return (
    <NumericButtonGrid
      ids={ids}
      readOnly={readOnly}
      formatLabel={(n) => labelFor(n)}
      isSelected={(n) => set.has(n)}
      onPick={(n) => {
        if (set.has(n)) {
          const nextSet = new Set(set);
          nextSet.delete(n);
          let vals = [...nextSet].sort((a, b) => a - b);
          if (vals.length === 0) vals = [fallbackWhenEmpty];
          onCommit(vals);
          return;
        }

        const replacePivot = implicitSingletonDefaultPivot ?? fallbackWhenEmpty;
        if (selected.length === 1 && selected[0] === replacePivot) {
          onCommit([n]);
          return;
        }

        const nextSet = new Set(set);
        nextSet.add(n);
        onCommit([...nextSet].sort((a, b) => a - b));
      }}
    />
  );
}

function parsedToDowWeeklyTab(parsed: ParsedCronSegment): DowWeeklyTab | null {
  if (parsed.type === 'nthWeekday') return null;
  switch (parsed.type) {
    case 'every':
      return 'every';
    case 'list':
    case 'range':
      return 'pick';
    case 'step':
      return 'step';
    default:
      return 'pick';
  }
}

function parsedToTab(p: ParsedCronSegment): EditorTab {
  switch (p.type) {
    case 'every':
      return 'every';
    case 'list':
    case 'range':
      return 'pick';
    case 'step':
      return 'step';
    case 'lastDom':
      return 'lastDom';
    case 'nthWeekday':
      return 'nth';
    default:
      return 'pick';
  }
}

function idListForKind(kind: CronFieldSegmentKind): string[] {
  const { min, max } = boundsForCronSegmentKind(kind);
  return Array.from({ length: max - min + 1 }, (_, i) => String(min + i));
}

/** 单段表达式为 `*`（任意）时在 Tab 上的文案 */
function everyTabLabelForSegmentKind(segmentKind: CronFieldSegmentKind): string {
  switch (segmentKind) {
    case 'minute':
      return '每分钟';
    case 'hour':
      return '每小时';
    case 'dom':
      return '每日';
    case 'month':
      return '每月';
    case 'dow':
      return '每周';
    default:
      return '任意';
  }
}

function activateEditorTab(
  m: EditorTab,
  opts: {
    min: number;
    kind: CronFieldSegmentKind;
    commit: (seg: ParsedCronSegment) => void;
    commitPick: (vals: readonly number[]) => void;
    setTab: (t: EditorTab) => void;
  },
) {
  const { min, kind, commit, commitPick, setTab } = opts;
  setTab(m);
  if (m === 'every') commit({ type: 'every' });
  else if (m === 'pick') commitPick([min]);
  else if (m === 'step') commit({ type: 'step', base: '*', interval: 5 });
  else if (m === 'lastDom' && kind === 'dom') commit({ type: 'lastDom' });
}

function applyDowWeeklyTab(
  m: DowWeeklyTab,
  opts: {
    min: number;
    commit: (seg: ParsedCronSegment) => void;
    commitPick: (vals: readonly number[]) => void;
  },
) {
  const { min, commit, commitPick } = opts;
  if (m === 'every') commit({ type: 'every' });
  else if (m === 'pick') commitPick([min]);
  else if (m === 'step') commit({ type: 'step', base: '*', interval: 5 });
}

function stepSentenceLabels(
  kind: CronFieldSegmentKind,
  baseStar: boolean,
): { basePrefix: string; baseSuffix: string; everySuffix: string } {
  const after = (() => {
    switch (kind) {
      case 'minute':
        return '分';
      case 'hour':
        return '时';
      case 'dom':
        return '日';
      case 'month':
        return '月';
      case 'dow':
        return '';
      default:
        return '';
    }
  })();

  const before = kind === 'dow' || baseStar ? '开始于' : '开始于第';

  const everyAfter = (() => {
    switch (kind) {
      case 'minute':
        return '分';
      case 'hour':
        return '时';
      case 'dom':
        return '日';
      case 'month':
        return '月';
      case 'dow':
        return '周';
      default:
        return '';
    }
  })();

  return { basePrefix: before, baseSuffix: after, everySuffix: everyAfter };
}

function StepRow(props: {
  kind: CronFieldSegmentKind;
  readOnly: boolean;
  parsed: ParsedCronSegment;
  onCommit: (seg: ParsedCronSegment) => void;
}) {
  const { kind, readOnly, parsed, onCommit } = props;
  const { min, max } = boundsForCronSegmentKind(kind);
  const ids = idListForKind(kind);
  const stepSeg =
    parsed.type === 'step'
      ? parsed
      : ({ type: 'step' as const, base: '*' as const, interval: Math.min(max, 5) } as const);

  const baseStar = stepSeg.base === '*';
  const baseNum = typeof stepSeg.base === 'number' ? Math.max(min, Math.min(stepSeg.base, max)) : min;
  const interval = Math.max(1, Math.min(Math.floor(Number(stepSeg.interval) || Math.min(max, 5)), max));

  const labels = stepSentenceLabels(kind, baseStar);
  const labelForOption = (n: number) => (kind === 'dow' ? (DOW_LABELS[n] ?? `星期${n}`) : String(n));

  const commitStep = (base: '*' | number, iv: number) => {
    const bounded = Math.max(1, Math.min(Math.floor(iv), max));
    onCommit({ type: 'step', base, interval: bounded });
  };

  return (
    <div className="flex flex-col gap-2">
      <InputGroup className="h-8 has-disabled:opacity-50">
        <InputGroupAddon align="inline-start" className="py-0 pl-2.5 font-normal">
          <InputGroupText className="gap-0 text-xs text-muted-foreground">{labels.basePrefix}</InputGroupText>
        </InputGroupAddon>
        <div className="flex min-h-8 min-w-0 flex-1 items-stretch">
          <Select
            disabled={readOnly}
            value={baseStar ? '*' : String(baseNum)}
            onValueChange={(next) => {
              if (next == null) return;
              if (next === '*') {
                commitStep('*', interval);
                return;
              }
              const n = Number(next);
              if (!Number.isFinite(n)) return;
              commitStep(Math.max(min, Math.min(n, max)), interval);
            }}
          >
            <SelectTrigger
              size="sm"
              data-slot="input-group-control"
              disabled={readOnly}
              className={cn(
                'h-8 min-h-8 min-w-[2.75rem] w-full flex-1 rounded-none border-0 bg-transparent py-0 pr-2 pl-2 text-xs shadow-none',
                '[&_svg:not([class*=size-])]:size-3.5',
                'ring-0 focus-visible:z-10 focus-visible:border-transparent focus-visible:ring-[3px] focus-visible:ring-ring/50',
                'dark:bg-transparent',
              )}
            >
              <SelectValue className="min-w-0 truncate text-left font-mono text-xs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="*" className="font-mono text-xs">
                *
              </SelectItem>
              {ids.map((id) => {
                const n = Number(id);
                return (
                  <SelectItem key={id} value={id} className="text-xs">
                    {labelForOption(n)}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
        {labels.baseSuffix ? (
          <InputGroupAddon align="inline-end" className="py-0 pr-2.5 font-normal">
            <InputGroupText className="gap-0 text-xs text-muted-foreground">{labels.baseSuffix}</InputGroupText>
          </InputGroupAddon>
        ) : null}
      </InputGroup>

      <InputGroup className="h-8 has-disabled:opacity-50">
        <InputGroupAddon align="inline-start" className="py-0 pl-2.5 font-normal">
          <InputGroupText className="gap-0 text-xs text-muted-foreground">每</InputGroupText>
        </InputGroupAddon>
        <div className="flex min-h-8 min-w-0 flex-1 items-stretch">
          <InputGroupInput
            type="number"
            min={1}
            max={max}
            disabled={readOnly}
            aria-label="步进间隔"
            value={interval}
            className="min-w-0 text-center text-xs font-mono"
            onChange={(e) => {
              const iv = Number(e.target.value);
              if (!Number.isFinite(iv) || iv < 1) return;
              commitStep(baseStar ? '*' : baseNum, iv);
            }}
          />
        </div>
        <InputGroupAddon align="inline-end" className="py-0 pr-2.5 font-normal">
          <InputGroupText className="gap-0 text-xs text-muted-foreground">{labels.everySuffix}</InputGroupText>
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}

function NthRow(props: { readOnly: boolean; dow: number; nth: number; onCommit: (dow: number, nth: number) => void }) {
  const { readOnly, dow, nth, onCommit } = props;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col">
        <div role="toolbar" aria-label="星期几" className="flex flex-wrap gap-1">
          {[0, 1, 2, 3, 4, 5, 6].map((d) => (
            <SegmentPickButton
              key={d}
              readOnly={readOnly}
              pressed={d === dow}
              ariaLabel={DOW_LABELS[d]}
              onPick={() => onCommit(d, nth)}
            >
              {DOW_LABELS[d]}
            </SegmentPickButton>
          ))}
        </div>
      </div>
      <div className="flex flex-col">
        <div role="toolbar" aria-label="第几周" className="flex flex-wrap gap-1">
          {[1, 2, 3, 4, 5].map((k) => (
            <SegmentPickButton
              key={k}
              readOnly={readOnly}
              pressed={k === nth}
              ariaLabel={`第 ${k}`}
              onPick={() => onCommit(dow, k)}
            >
              {String(k)}
            </SegmentPickButton>
          ))}
        </div>
      </div>
    </div>
  );
}

function DowMonthlyNthOnlyBody(props: { value: string; onChange: (next: string) => void; readOnly: boolean }) {
  const { value, onChange, readOnly } = props;
  const parsed = useMemo(() => parseCronSegmentToken(value, 'dow'), [value]);

  const commit = (seg: ParsedCronSegment) => {
    onChange(serializeCronSegment(seg, 'dow'));
  };

  return (
    <div className="flex flex-col gap-2">
      <NthRow
        readOnly={readOnly}
        dow={parsed.type === 'nthWeekday' ? parsed.dow : 1}
        nth={parsed.type === 'nthWeekday' ? parsed.nth : 1}
        onCommit={(dow, nth) => commit({ type: 'nthWeekday', dow, nth })}
      />
    </div>
  );
}

function DowCronSegmentEditorBody(props: {
  value: string;
  onChange: (next: string) => void;
  readOnly: boolean;
  /** 若为 false，隐藏「按月 #」（主导航选中「每周」预设时不应在此处配 #） */
  allowsDowMonthlyNth: boolean;
  implicitSingletonDefaultPivot?: number;
}) {
  const { value, onChange, readOnly, allowsDowMonthlyNth, implicitSingletonDefaultPivot } = props;
  const parsed = useMemo(() => parseCronSegmentToken(value, 'dow'), [value]);
  const { min } = boundsForCronSegmentKind('dow');
  const ids = idListForKind('dow');

  const dowWeeklyUiTab = parsedToDowWeeklyTab(parsed);

  const commit = (seg: ParsedCronSegment) => {
    onChange(serializeCronSegment(seg, 'dow'));
  };

  const commitPick = (vals: readonly number[]) => {
    onChange(serializeSegmentPickToken(vals, 'dow'));
  };

  const weeklyChoices: { value: DowWeeklyTab; label: string }[] = [
    { value: 'every', label: everyTabLabelForSegmentKind('dow') },
    { value: 'pick', label: '指定' },
    { value: 'step', label: '步进' },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <div
          className="inline-flex h-auto w-fit max-w-full flex-wrap gap-1 rounded-lg bg-muted/80 p-1 text-muted-foreground"
          role="tablist"
          aria-label="星期"
        >
          {weeklyChoices.map((c) => (
            <Button
              key={c.value}
              type="button"
              variant="ghost"
              size="sm"
              role="tab"
              aria-selected={dowWeeklyUiTab === c.value}
              disabled={readOnly}
              className={cn(
                'h-7 flex-none rounded-md px-2 py-1 text-xs font-medium transition-all',
                dowWeeklyUiTab === c.value
                  ? 'bg-background text-foreground shadow-sm dark:bg-input/30'
                  : 'text-muted-foreground hover:bg-transparent hover:text-foreground dark:hover:bg-transparent',
              )}
              onClick={() => applyDowWeeklyTab(c.value, { min, commit, commitPick })}
            >
              {c.label}
            </Button>
          ))}
        </div>

        {dowWeeklyUiTab === 'pick' ? (
          <div className="pt-1">
            <PickToggleGrid
              ids={ids}
              readOnly={readOnly}
              fallbackWhenEmpty={min}
              implicitSingletonDefaultPivot={implicitSingletonDefaultPivot}
              kind="dow"
              selected={expandedSegmentPickValues(value, 'dow')}
              onCommit={(vals) => commitPick(vals)}
            />
          </div>
        ) : null}
        {dowWeeklyUiTab === 'step' ? (
          <div className="pt-1">
            <StepRow kind="dow" readOnly={readOnly} parsed={parsed} onCommit={(seg) => commit(seg)} />
          </div>
        ) : null}
      </div>

      {allowsDowMonthlyNth ? (
        <>
          <Separator className="bg-border/80" />

          <div className="flex flex-col gap-2">
            <NthRow
              readOnly={readOnly}
              dow={parsed.type === 'nthWeekday' ? parsed.dow : 1}
              nth={parsed.type === 'nthWeekday' ? parsed.nth : 1}
              onCommit={(dow, nth) => commit({ type: 'nthWeekday', dow, nth })}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

function CronSegmentEditorBody(props: {
  kind: CronFieldSegmentKind;
  value: string;
  onChange: (next: string) => void;
  readOnly: boolean;
  dowPopoverLayout?: CronDowPopoverLayout;
  implicitSingletonDefaultPivot?: number;
}) {
  if (props.kind === 'dow') {
    const { value, onChange, readOnly, dowPopoverLayout = 'default', implicitSingletonDefaultPivot } = props;
    if (dowPopoverLayout === 'preset_monthly_nth') {
      return <DowMonthlyNthOnlyBody value={value} onChange={onChange} readOnly={readOnly} />;
    }
    const allowsDowMonthlyNth = dowPopoverLayout !== 'preset_weekly';
    return (
      <DowCronSegmentEditorBody
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        allowsDowMonthlyNth={allowsDowMonthlyNth}
        implicitSingletonDefaultPivot={implicitSingletonDefaultPivot}
      />
    );
  }
  return (
    <GenericCronSegmentEditorBody
      kind={props.kind}
      value={props.value}
      onChange={props.onChange}
      readOnly={props.readOnly}
      implicitSingletonDefaultPivot={props.implicitSingletonDefaultPivot}
    />
  );
}

function GenericCronSegmentEditorBody(props: {
  kind: CronFieldSegmentKind;
  value: string;
  onChange: (next: string) => void;
  readOnly: boolean;
  implicitSingletonDefaultPivot?: number;
}) {
  const { kind, value, onChange, readOnly, implicitSingletonDefaultPivot } = props;
  const parsed = parseCronSegmentToken(value, kind);
  const { min } = boundsForCronSegmentKind(kind);
  const ids = idListForKind(kind);
  const [tab, setTab] = useState<EditorTab>(() => parsedToTab(parsed));

  const commit = (seg: ParsedCronSegment) => {
    onChange(serializeCronSegment(seg, kind));
  };

  const commitPick = (vals: readonly number[]) => {
    onChange(serializeSegmentPickToken(vals, kind));
  };

  const tabItems = useMemo(() => {
    const base: { value: EditorTab; label: string }[] = [
      { value: 'every', label: everyTabLabelForSegmentKind(kind) },
      { value: 'pick', label: '指定' },
      { value: 'step', label: '步进' },
    ];
    if (kind === 'dom') base.push({ value: 'lastDom', label: '月末 L' });
    return base;
  }, [kind]);

  const onTabChange = (next: string) => {
    if (readOnly) return;
    activateEditorTab(next as EditorTab, { min, kind, commit, commitPick, setTab });
  };

  return (
    <div className="flex flex-col">
      <Tabs value={tab} onValueChange={onTabChange} className="w-full items-start gap-3">
        <TabsList className="inline-flex h-auto w-fit max-w-full flex-wrap gap-1 rounded-lg bg-muted/80 p-1 text-muted-foreground">
          {tabItems.map((t) => (
            <TabsTrigger key={t.value} value={t.value} disabled={readOnly} className="flex-none px-2 py-1 text-xs">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="every" className="mt-0" />

        <TabsContent value="pick" className="mt-0 pt-1">
          <PickToggleGrid
            ids={ids}
            readOnly={readOnly}
            fallbackWhenEmpty={min}
            implicitSingletonDefaultPivot={implicitSingletonDefaultPivot}
            kind={kind}
            selected={expandedSegmentPickValues(value, kind)}
            onCommit={(vals) => commitPick(vals)}
          />
        </TabsContent>

        <TabsContent value="step" className="mt-0 pt-1">
          <StepRow kind={kind} readOnly={readOnly} parsed={parsed} onCommit={(seg) => commit(seg)} />
        </TabsContent>

        {kind === 'dom' ? <TabsContent value="lastDom" className="mt-0 pt-1" /> : null}
      </Tabs>
    </div>
  );
}

export type CronSegmentPopoverFieldProps = {
  segmentKind: CronFieldSegmentKind;
  /** 星期段弹层形态；非星期段可省略 */
  dowPopoverLayout?: CronDowPopoverLayout;
  /**
   * 「指定」多选：当前仅选中该值且与预设默认一致时，再点其它格子会整段替换为新值（与 {@link PickToggleGrid} 一致）。
   * 未传时用该段 `min` 作为占位比较值。
   */
  implicitSingletonDefaultPivot?: number;
  value: string;
  onValueChange: (next: string) => void;
  readOnly?: boolean;
  disabled?: boolean;
  id?: string;
  size?: 'sm' | 'default';
  className?: string;
};

export function CronSegmentPopoverField(props: CronSegmentPopoverFieldProps) {
  const {
    segmentKind,
    dowPopoverLayout,
    implicitSingletonDefaultPivot,
    value,
    onValueChange,
    readOnly = false,
    disabled = false,
    id,
    size = 'sm',
    className,
  } = props;
  const [open, setOpen] = useState(false);
  const [editorNonce, setEditorNonce] = useState(0);
  const blockInteraction = Boolean(disabled) || Boolean(readOnly);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- match components/ui/date-picker.tsx (close when readOnly/disabled)
    if (blockInteraction) setOpen(false);
  }, [blockInteraction]);

  const summary = useMemo(() => {
    const t = value.trim();
    if (!t) return '—';
    if (segmentKind === 'dow') return formatDowSegmentSummary(t);
    return t;
  }, [value, segmentKind]);

  const summaryMono = segmentKind !== 'dow';
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (blockInteraction && next) return;
        if (next) setEditorNonce((n) => n + 1);
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
          data-empty={summary === '—'}
          size={size}
          className={cn(
            'w-full justify-between font-normal data-[empty=true]:text-muted-foreground',
            summaryMono && 'font-mono',
            size === 'sm' && 'h-7 rounded-[min(var(--radius-md),10px)] px-2.5 text-xs',
            className,
          )}
        >
          <span className="min-w-0 flex-1 truncate text-left">{summary}</span>
          <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="border-border max-h-none w-[min(92vw,17.5rem)] gap-0 overflow-visible p-0"
      >
        <div className="p-3">
          <CronSegmentEditorBody
            key={editorNonce}
            kind={segmentKind}
            dowPopoverLayout={segmentKind === 'dow' ? dowPopoverLayout : undefined}
            implicitSingletonDefaultPivot={implicitSingletonDefaultPivot}
            value={value}
            readOnly={readOnly}
            onChange={(next) => {
              onValueChange(next);
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
