import type { FactorDetailPublic } from '@/models/factor/dto';

export type FactorFormState = {
  name: string;
  group: string;
  description: string;
  max_window: string;
  dependencies_csv: string;
  source: string;
};

/** 新建因子页默认标识：「新因子」+ 日期时间，须满足服务端 `name.isidentifier()`。 */
export function defaultNewFactorName(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = d.getFullYear();
  const mo = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const h = pad(d.getHours());
  const mi = pad(d.getMinutes());
  const s = pad(d.getSeconds());
  return `新因子_${y}${mo}${day}_${h}${mi}${s}`;
}

/** Initial shell; `source` is filled from GET /factors/template on the new-factor page. */
export function emptyForm(): FactorFormState {
  return {
    name: '新因子',
    group: '未分组',
    description: '',
    max_window: '1',
    dependencies_csv: 'close',
    source: '',
  };
}

export function hydrateFromDetail(d: FactorDetailPublic): FactorFormState {
  return {
    name: d.name,
    group: d.group,
    description: d.description,
    max_window: String(d.max_window),
    dependencies_csv: d.dependencies.join(', '),
    source: d.source,
  };
}

export function parseDependencies(csv: string): string[] {
  return csv
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function validateFormForSubmit(form: FactorFormState): string | null {
  if (!form.name.trim()) return '因子标识（name）不能为空';
  const mw = Number.parseInt(form.max_window, 10);
  if (!Number.isFinite(mw) || mw < 1) return 'max_window 须为 >= 1 的整数';
  const deps = parseDependencies(form.dependencies_csv);
  if (deps.length === 0) return '至少填写一个依赖字段（如 close）';
  if (!form.source.trim()) return '源码不能为空';
  return null;
}

export function bodyFromForm(form: FactorFormState): Record<string, unknown> {
  const deps = parseDependencies(form.dependencies_csv);
  const max_window = Number.parseInt(form.max_window, 10);
  return {
    name: form.name.trim(),
    group: form.group.trim(),
    description: form.description.trim(),
    max_window,
    dependencies: deps,
    source: form.source,
  };
}
