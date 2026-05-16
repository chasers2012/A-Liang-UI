export type CronPresetMode =
  | 'every_minute'
  | 'every_hour'
  | 'daily'
  | 'weekly'
  | 'monthly_day'
  | 'monthly_week'
  | 'advanced';

export interface CronFieldModel {
  preset: CronPresetMode;
  /** 0–59，至少一项（预设 UI 内） */
  minutes: number[];
  /** 0–23 */
  hours: number[];
  /** 1–31 */
  daysOfMonth: number[];
  /** 0–6，0=周日 */
  daysOfWeek: number[];
  /** `monthly_week`：月中第几周 1–5，与 {@link daysOfWeek} 单一项组成 `dow#nth` */
  nthOfMonth?: number;
}

/**
 * 解析逗号分段；每段可为单个整数或闭区间 `a-b`（与 Quartz 列举一致）。
 * 不支持 `/` `#` `L` 等；非法返回 null。
 */
export function parseIntListField(s: string, min: number, max: number): number[] | null {
  const parts = s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  const nums: number[] = [];
  for (const p of parts) {
    if (/^\d+$/.test(p)) {
      const n = Number(p);
      if (n < min || n > max) return null;
      nums.push(n);
      continue;
    }
    const m = /^(\d+)-(\d+)$/.exec(p);
    if (!m) return null;
    let a = Number(m[1]);
    let b = Number(m[2]);
    if (a > b) [a, b] = [b, a];
    if (a < min || b > max) return null;
    for (let k = a; k <= b; k += 1) nums.push(k);
  }
  return [...new Set(nums)].sort((a, b) => a - b);
}

function normalizeDowList(nums: number[]): number[] {
  const mapped = nums.map((n) => (n === 7 ? 0 : n));
  return [...new Set(mapped)].sort((a, b) => a - b);
}

function parseDowSegment(s: string): number[] | null {
  const raw = parseIntListField(s, 0, 7);
  if (raw == null) return null;
  return normalizeDowList(raw);
}

/** 已排序、去重的整数 → `1,3,10-15`（与分段序列化一致） */
function formatSortedIntRunsForCronExpr(sorted: readonly number[]): string {
  if (sorted.length === 0) return '';
  if (sorted.length === 1) return String(sorted[0]);
  const parts: string[] = [];
  let a = sorted[0];
  let b = sorted[0];
  for (let i = 1; i < sorted.length; i += 1) {
    const x = sorted[i];
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

function joinCronPart(nums: number[]): string {
  if (nums.length === 0) return '0';
  const sorted = [...new Set(nums)].sort((x, y) => x - y);
  return formatSortedIntRunsForCronExpr(sorted);
}

const EMPTY_ADVANCED: Omit<CronFieldModel, 'preset'> = {
  minutes: [0],
  hours: [0],
  daysOfMonth: [1],
  daysOfWeek: [1],
};

function parseMinuteHour(parts: string[]): { minutes: number[]; hours: number[] } | null {
  const minutes = parseIntListField(parts[0], 0, 59);
  const hours = parseIntListField(parts[1], 0, 23);
  if (minutes == null || hours == null) return null;
  return { minutes, hours };
}

function tryFixedPresets(parts: string[]): CronFieldModel | null {
  const [minS, hourS, domS, monthS, dowS] = parts;
  if (minS === '*' && hourS === '*' && domS === '*' && monthS === '*' && dowS === '*') {
    return { preset: 'every_minute', minutes: [], hours: [], daysOfMonth: [1], daysOfWeek: [0] };
  }
  /** 每分钟字段为列举式、时以下为 `* * *`，按「每小时在第几分钟」预设解析 */
  if (hourS === '*' && domS === '*' && monthS === '*' && dowS === '*' && minS !== '*') {
    const minutes = parseIntListField(minS, 0, 59);
    if (minutes == null) return null;
    return { preset: 'every_hour', minutes, hours: [], daysOfMonth: [1], daysOfWeek: [0] };
  }
  return null;
}

function tryDaily(
  domS: string,
  monthS: string,
  dowS: string,
  minutes: number[],
  hours: number[],
): CronFieldModel | null {
  if (domS !== '*' || monthS !== '*' || dowS !== '*') return null;
  return { preset: 'daily', minutes, hours, daysOfMonth: [1], daysOfWeek: [0] };
}

function tryWeekly(
  domS: string,
  monthS: string,
  dowS: string,
  minutes: number[],
  hours: number[],
): CronFieldModel | null {
  if (domS !== '*' || monthS !== '*' || dowS === '*') return null;
  const dows = parseDowSegment(dowS);
  if (dows == null || dowS.includes('/')) {
    return { preset: 'advanced', minutes, hours, daysOfMonth: [1], daysOfWeek: dows ?? [1] };
  }
  return { preset: 'weekly', minutes, hours, daysOfMonth: [1], daysOfWeek: dows };
}

function tryMonthlyDay(
  domS: string,
  monthS: string,
  dowS: string,
  minutes: number[],
  hours: number[],
): CronFieldModel | null {
  if (domS === '*' || monthS !== '*' || dowS !== '*') return null;
  const doms = parseIntListField(domS, 1, 31);
  if (doms == null || domS.includes('/')) {
    return { preset: 'advanced', minutes, hours, daysOfMonth: doms ?? [1], daysOfWeek: [0] };
  }
  return { preset: 'monthly_day', minutes, hours, daysOfMonth: doms, daysOfWeek: [0] };
}

function tryMonthlyWeek(
  domS: string,
  monthS: string,
  dowS: string,
  minutes: number[],
  hours: number[],
): CronFieldModel | null {
  if (domS !== '?' || monthS !== '*' || dowS === '*') return null;
  const mNth = /^(\d+)#(\d+)$/i.exec(dowS.trim());
  if (!mNth) return null;
  let dowNum = Number(mNth[1]);
  if (dowNum === 7) dowNum = 0;
  const nth = Number(mNth[2]);
  if (dowNum < 0 || dowNum > 6 || nth < 1 || nth > 5) return null;
  return {
    preset: 'monthly_week',
    minutes,
    hours,
    daysOfMonth: [1],
    daysOfWeek: [dowNum],
    nthOfMonth: nth,
  };
}

function tryDailyWeeklyMonthly(parts: string[], minutes: number[], hours: number[]): CronFieldModel | null {
  const [, , domS, monthS, dowS] = parts;
  return (
    tryDaily(domS, monthS, dowS, minutes, hours) ??
    tryWeekly(domS, monthS, dowS, minutes, hours) ??
    tryMonthlyDay(domS, monthS, dowS, minutes, hours) ??
    tryMonthlyWeek(domS, monthS, dowS, minutes, hours)
  );
}

/** 将常见 5 字段表达式解析为预设；分/时/日/周支持逗号与单段闭区间 `-`；带 `/` 等步进归为 advanced。 */
export function parseCronExpression(expr: string): CronFieldModel {
  const t = expr.trim();
  if (!t) {
    return { preset: 'advanced', ...EMPTY_ADVANCED };
  }
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length !== 5) {
    return { preset: 'advanced', ...EMPTY_ADVANCED };
  }

  const fixed = tryFixedPresets(parts);
  if (fixed) return fixed;

  const mh = parseMinuteHour(parts);
  if (!mh) {
    return { preset: 'advanced', ...EMPTY_ADVANCED };
  }

  const scheduled = tryDailyWeeklyMonthly(parts, mh.minutes, mh.hours);
  if (scheduled) return scheduled;

  return {
    preset: 'advanced',
    minutes: mh.minutes,
    hours: mh.hours,
    daysOfMonth: [1],
    daysOfWeek: [1],
  };
}

export function serializeCronExpression(m: CronFieldModel): string {
  switch (m.preset) {
    case 'every_minute':
      return '* * * * *';
    case 'every_hour':
      return `${joinCronPart(m.minutes)} * * * *`;
    case 'daily':
      return `${joinCronPart(m.minutes)} ${joinCronPart(m.hours)} * * *`;
    case 'weekly':
      return `${joinCronPart(m.minutes)} ${joinCronPart(m.hours)} * * ${joinCronPart(m.daysOfWeek)}`;
    case 'monthly_day':
      return `${joinCronPart(m.minutes)} ${joinCronPart(m.hours)} ${joinCronPart(m.daysOfMonth)} * *`;
    case 'monthly_week': {
      const dow = m.daysOfWeek[0] ?? 1;
      const nth = m.nthOfMonth ?? 1;
      return `${joinCronPart(m.minutes)} ${joinCronPart(m.hours)} ? * ${dow}#${nth}`;
    }
    default:
      return '';
  }
}
