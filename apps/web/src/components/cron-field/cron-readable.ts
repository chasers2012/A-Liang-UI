import { type CronFieldModel, parseCronExpression } from '@/components/cron-field/cron-expr';

/** 周一至周六用「一二…六」，周日用「日」，与口语「周二、周四」简称一致 */
const DOW_MERGE_SUFFIX = ['日', '一', '二', '三', '四', '五', '六'] as const;

const NTH_WEEK_CN = ['', '第一', '第二', '第三', '第四', '第五'] as const;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatHm(h: number, m: number): string {
  return `${pad2(h)}:${pad2(m)}`;
}

/** 将已排序去重整数列合并连续区间为「a到b」，单独一项为「a」 */
function groupConsecutiveRuns(sorted: readonly number[]): Array<[number, number]> {
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

function formatIntRunsCn(sorted: readonly number[]): string {
  return groupConsecutiveRuns(sorted)
    .map(([from, to]) => (from === to ? String(from) : `${from}到${to}`))
    .join('、');
}

function formatDomRunsCn(sorted: readonly number[]): string {
  return groupConsecutiveRuns(sorted)
    .map(([from, to]) => (from === to ? `${from}号` : `${from}到${to}号`))
    .join('、');
}

function totalMinutes(hm: readonly [number, number]): number {
  return hm[0] * 60 + hm[1];
}

/** 按时序合并相邻分钟（差 1 分钟）为「HH:mm到HH:mm」 */
function formatHmPairRanges(pairs: Array<[number, number]>): string {
  if (pairs.length === 0) return formatHm(0, 0);
  const sorted = [...pairs].sort((x, y) => totalMinutes(x) - totalMinutes(y));
  const parts: string[] = [];
  let sh = sorted[0][0],
    sm = sorted[0][1];
  let eh = sh,
    em = sm;
  const flush = (): void => {
    if (sh === eh && sm === em) parts.push(formatHm(sh, sm));
    else parts.push(`${formatHm(sh, sm)}到${formatHm(eh, em)}`);
  };
  for (let i = 1; i < sorted.length; i++) {
    const [h, m] = sorted[i];
    if (totalMinutes([h, m]) === totalMinutes([eh, em]) + 1) {
      eh = h;
      em = m;
    } else {
      flush();
      sh = eh = h;
      sm = em = m;
    }
  }
  flush();
  return parts.join('、');
}

/** 时点列表：`时 × 分` 全部组合后按时间排序 */
function sortedHmPairs(hours: readonly number[], minutes: readonly number[]): Array<[number, number]> {
  const hs = [...new Set(hours)].sort((a, b) => a - b);
  const ms = [...new Set(minutes)].sort((a, b) => a - b);
  const pairs: Array<[number, number]> = [];
  for (const h of hs) {
    for (const m of ms) {
      pairs.push([h, m]);
    }
  }
  pairs.sort((a, b) => (a[0] !== b[0] ? a[0] - b[0] : a[1] - b[1]));
  return pairs;
}

/** 多个时刻合并为一串，例如 `12:00` 或 `08:00到10:00、18:30` */
function mergedTimeList(hours: readonly number[], minutes: readonly number[], maxShow = 8): string {
  const pairs = sortedHmPairs(hours.length ? hours : [0], minutes.length ? minutes : [0]);
  if (pairs.length === 0) return formatHm(0, 0);
  if (pairs.length <= maxShow) return formatHmPairRanges(pairs);
  const fmts = pairs.map(([h, m]) => formatHm(h, m));
  return `${fmts.slice(0, maxShow).join('、')}…共 ${pairs.length} 个时刻`;
}

function dowLabelCn(dow: number): string {
  return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][dow] ?? `星期${dow}`;
}

function nthWeekCn(nth: number): string {
  if (nth >= 1 && nth <= 5) return NTH_WEEK_CN[nth] ?? '';
  return `第${nth}`;
}

function readableEveryHour(model: CronFieldModel): string {
  const mins = model.minutes.length ? [...new Set(model.minutes)].sort((a, b) => a - b) : [0];
  if (mins.length === 1) return `每小时，第 ${mins[0]} 分`;
  return `每小时，第 ${formatIntRunsCn(mins)} 分`;
}

/** `每周二、四、六`；连续工作日等为「每周一到五」 */
function mergedWeeklyDows(dows: readonly number[]): string {
  const sorted = [...new Set(dows)].sort((a, b) => a - b);
  const segments = groupConsecutiveRuns(sorted).map(([from, to]) =>
    from === to ? (DOW_MERGE_SUFFIX[from] ?? '?') : `${DOW_MERGE_SUFFIX[from] ?? '?'}到${DOW_MERGE_SUFFIX[to] ?? '?'}`,
  );
  return `每周${segments.join('、')}`;
}

function readableWeekly(model: CronFieldModel): string {
  const dows = model.daysOfWeek.length ? [...new Set(model.daysOfWeek)].sort((a, b) => a - b) : [1];
  const times = mergedTimeList(model.hours, model.minutes);
  return `${mergedWeeklyDows(dows)}，${times}`;
}

function readableMonthlyDay(model: CronFieldModel): string {
  const doms = model.daysOfMonth.length ? [...new Set(model.daysOfMonth)].sort((a, b) => a - b) : [1];
  const times = mergedTimeList(model.hours, model.minutes);
  return `每月${formatDomRunsCn(doms)}，${times}`;
}

function readableMonthlyWeek(model: CronFieldModel): string {
  const dow = model.daysOfWeek[0] ?? 1;
  const nth = model.nthOfMonth ?? 1;
  const times = mergedTimeList(model.hours, model.minutes);
  return `每月${nthWeekCn(nth)}个${dowLabelCn(dow)}，${times}`;
}

function summarizeFromModel(model: CronFieldModel): string {
  switch (model.preset) {
    case 'every_minute':
      return '每分钟';
    case 'every_hour':
      return readableEveryHour(model);
    case 'daily':
      return `每天${mergedTimeList(model.hours, model.minutes)}`;
    case 'weekly':
      return readableWeekly(model);
    case 'monthly_day':
      return readableMonthlyDay(model);
    case 'monthly_week':
      return readableMonthlyWeek(model);
    default:
      return '自定义';
  }
}

/** 表单外展示的简短可读说明，句末附全角括号内的原始 cron 五段字面量 */
export function formatCronReadableSummary(expr: string): string {
  const t = expr.trim();
  if (!t) return '未设置调度';
  const readable = summarizeFromModel(parseCronExpression(t));
  return `${readable}（${t}）`;
}
