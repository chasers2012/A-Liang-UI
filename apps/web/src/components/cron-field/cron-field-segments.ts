import { parseIntListField } from '@/components/cron-field/cron-expr';

/** 单行 cron token 所属的 5 段之一 */
export type CronFieldSegmentKind = 'minute' | 'hour' | 'dom' | 'month' | 'dow';

export type ParsedCronSegment =
  | { type: 'every' }
  | { type: 'list'; values: number[] }
  | { type: 'range'; from: number; to: number }
  /** 步进：星号步进（如 star-div-5）或起数字 m/n */
  | { type: 'step'; base: '*' | number; interval: number }
  | { type: 'lastDom' }
  | { type: 'nthWeekday'; dow: number; nth: number }
  /** 无法结构化或混写 */
  | { type: 'opaque'; raw: string };

const RANGE = /^(\d+)-(\d+)$/;
const STEP_STAR = /^\*\/(\d+)$/;
const STEP_NUM = /^(\d+)\/(\d+)$/;
const NTH_WD = /^(\d+)#(\d+)$/i;

/** 仅用数字、空白、逗号、连字符的列举式表达式（可含区间 a-b）；无 `/` `#` `L` 等 */
export function isCronPresetSimpleGlyphs(expr: string): boolean {
  const t = expr.trim();
  if (!t) return true;
  return /^[\d\s\-,]+$/.test(t);
}

export function splitCronExpression(expr: string): string[] | null {
  const t = expr.trim();
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length !== 5) return null;
  return parts;
}

export function joinCronParts(parts: readonly [string, string, string, string, string]): string {
  return parts.join(' ');
}

export function boundsForCronSegmentKind(kind: CronFieldSegmentKind): { min: number; max: number } {
  switch (kind) {
    case 'minute':
      return { min: 0, max: 59 };
    case 'hour':
      return { min: 0, max: 23 };
    case 'dom':
      return { min: 1, max: 31 };
    case 'month':
      return { min: 1, max: 12 };
    case 'dow':
      return { min: 0, max: 6 };
    default:
      return { min: 0, max: 0 };
  }
}

function normalizeDow(n: number): number {
  if (n === 7) return 0;
  return n;
}

function inRange(n: number, min: number, max: number): boolean {
  return n >= min && n <= max;
}

function tryNthWeekday(s: string, kind: CronFieldSegmentKind): ParsedCronSegment | undefined {
  if (kind !== 'dow') return undefined;
  const mNth = NTH_WD.exec(s);
  if (!mNth) return undefined;
  const dow = normalizeDow(Number(mNth[1]));
  const nth = Number(mNth[2]);
  if (inRange(dow, 0, 6) && nth >= 1 && nth <= 5) return { type: 'nthWeekday', dow, nth };
  return { type: 'opaque', raw: s };
}

function tryStepStar(s: string): ParsedCronSegment | undefined {
  const mStar = STEP_STAR.exec(s);
  if (!mStar) return undefined;
  const interval = Number(mStar[1]);
  if (interval >= 1) return { type: 'step', base: '*', interval };
  return { type: 'opaque', raw: s };
}

function tryStepNum(s: string, min: number, max: number): ParsedCronSegment | undefined {
  const mNumStep = STEP_NUM.exec(s);
  if (!mNumStep) return undefined;
  const baseNum = Number(mNumStep[1]);
  const interval = Number(mNumStep[2]);
  if (!inRange(baseNum, min, max)) return { type: 'opaque', raw: s };
  if (interval < 1) return { type: 'opaque', raw: s };
  return { type: 'step', base: baseNum, interval };
}

function tryNumericRange(s: string, min: number, max: number): ParsedCronSegment | undefined {
  const mRange = RANGE.exec(s);
  if (!mRange) return undefined;
  const from = Number(mRange[1]);
  const to = Number(mRange[2]);
  if (from <= to && inRange(from, min, max) && inRange(to, min, max)) return { type: 'range', from, to };
  return { type: 'opaque', raw: s };
}

function tryIntListSegment(s: string, min: number, max: number): ParsedCronSegment | undefined {
  const listed = parseIntListField(s, min, max);
  if (!listed?.length) return undefined;
  const partsTrim = s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  if (partsTrim.length === 0) return { type: 'opaque', raw: s };
  if (partsTrim.some((p) => !/^\d+$/.test(p) && !/^\d+-\d+$/.test(p))) return { type: 'opaque', raw: s };
  return { type: 'list', values: listed };
}

/** 解析单段 token → 编辑器结构；不改变合法 cron 字面量语义 */
export function parseCronSegmentToken(raw: string, kind: CronFieldSegmentKind): ParsedCronSegment {
  const s = raw.trim();
  const { min, max } = boundsForCronSegmentKind(kind);

  if (s === '*') return { type: 'every' };
  if (kind === 'dom' && /^L$/i.test(s)) return { type: 'lastDom' };

  const nth = tryNthWeekday(s, kind);
  if (nth !== undefined) return nth;
  const starStep = tryStepStar(s);
  if (starStep !== undefined) return starStep;
  const numStep = tryStepNum(s, min, max);
  if (numStep !== undefined) return numStep;
  const range = tryNumericRange(s, min, max);
  if (range !== undefined) return range;
  const list = tryIntListSegment(s, min, max);
  if (list !== undefined) return list;

  return { type: 'opaque', raw: s };
}

/** 已排序、去重的整数 → Quartz 式列举：`1,3,5-7,10`（连续段压缩为 a-b） */
function formatSortedIntRunList(values: readonly number[]): string {
  if (values.length === 0) return '';
  if (values.length === 1) return String(values[0]);
  const parts: string[] = [];
  let a = values[0];
  let b = values[0];
  for (let i = 1; i < values.length; i += 1) {
    const x = values[i];
    if (x === b + 1) {
      b = x;
      continue;
    }
    parts.push(b === a ? String(a) : `${a}-${b}`);
    a = x;
    b = x;
  }
  parts.push(b === a ? String(a) : `${a}-${b}`);
  return parts.join(',');
}

export function serializeCronSegment(seg: ParsedCronSegment, kind: CronFieldSegmentKind): string {
  const { min, max } = boundsForCronSegmentKind(kind);
  switch (seg.type) {
    case 'every':
      return '*';
    case 'list': {
      if (seg.values.length === 0) return '*';
      const sorted = [...new Set(seg.values)].filter((n) => n >= min && n <= max).sort((a, b) => a - b);
      return formatSortedIntRunList(sorted) || '*';
    }
    case 'range':
      return `${seg.from}-${seg.to}`;
    case 'step':
      return seg.base === '*' ? `*/${seg.interval}` : `${seg.base}/${seg.interval}`;
    case 'lastDom':
      return 'L';
    case 'nthWeekday':
      return `${seg.dow}#${seg.nth}`;
    case 'opaque':
      return seg.raw;
    default:
      return '*';
  }
}

/** 列表 / 单段区间展开的选中集合（闭合区间逐项铺开）；其余情况返回空数组（由点选补齐） */
export function expandedSegmentPickValues(raw: string, kind: CronFieldSegmentKind): number[] {
  const { min, max } = boundsForCronSegmentKind(kind);
  const p = parseCronSegmentToken(raw.trim(), kind);
  if (p.type === 'list') {
    return [...new Set(p.values)].filter((n) => n >= min && n <= max).sort((a, b) => a - b);
  }
  if (p.type === 'range') {
    const lo = Math.min(p.from, p.to);
    const hi = Math.max(p.from, p.to);
    return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
  }
  return [];
}

/** 「指定」多选：连续段写 `a-b`，多段/散点逗号分隔，可多段区间混写如 `1,4-6,30` */
export function serializeSegmentPickToken(values: readonly number[], kind: CronFieldSegmentKind): string {
  const { min, max } = boundsForCronSegmentKind(kind);
  const sorted = [...new Set(values)].filter((n) => n >= min && n <= max).sort((a, b) => a - b);
  if (sorted.length === 0) return String(min);
  return formatSortedIntRunList(sorted);
}
export function defaultSegmentParts(): [string, string, string, string, string] {
  return ['*', '*', '*', '*', '*'];
}

/** 星期段弹层 UI 形态 */
export type CronDowPopoverLayout = 'preset_weekly' | 'preset_monthly_nth' | 'default';

const DOW_READABLE_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const;

const NTH_WEEK_READABLE = ['', '第一', '第二', '第三', '第四', '第五'] as const;

function dowReadableLabel(dow: number): string {
  return DOW_READABLE_LABELS[dow] ?? `星期${dow}`;
}

function nthWeekReadable(nth: number): string {
  if (nth >= 1 && nth <= 5) return NTH_WEEK_READABLE[nth] ?? `第${nth}个`;
  return `第${nth}个`;
}

function groupConsecutiveInts(sorted: readonly number[]): Array<[number, number]> {
  if (sorted.length === 0) return [];
  const runs: Array<[number, number]> = [];
  let a = sorted[0];
  let b = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    const x = sorted[i];
    if (x === b + 1) b = x;
    else {
      runs.push([a, b]);
      a = b = x;
    }
  }
  runs.push([a, b]);
  return runs;
}

function formatDowPickReadable(sorted: readonly number[]): string {
  return groupConsecutiveInts(sorted)
    .map(([from, to]) => (from === to ? dowReadableLabel(from) : `${dowReadableLabel(from)}到${dowReadableLabel(to)}`))
    .join('、');
}

/** 「周」段外链按钮上的可读摘要（列举 / 区间合并为「周一到周五」等） */
export function formatDowSegmentSummary(raw: string): string {
  const s = raw.trim();
  if (!s) return '—';
  const p = parseCronSegmentToken(s, 'dow');
  switch (p.type) {
    case 'every':
      return '每周';
    case 'list': {
      const sorted = [...new Set(p.values)].sort((a, b) => a - b);
      return formatDowPickReadable(sorted);
    }
    case 'range': {
      const lo = Math.min(p.from, p.to);
      const hi = Math.max(p.from, p.to);
      const vals = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
      return formatDowPickReadable(vals);
    }
    case 'nthWeekday':
      return `每月${nthWeekReadable(p.nth)}个${dowReadableLabel(p.dow)}`;
    case 'step': {
      const iv = p.interval;
      if (p.base === '*') return `开始于任意，每 ${iv} 周`;
      return `开始于${dowReadableLabel(p.base)}，每 ${iv} 周`;
    }
    case 'opaque':
      return s;
    default:
      return s;
  }
}
