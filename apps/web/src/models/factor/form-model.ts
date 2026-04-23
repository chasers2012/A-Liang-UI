import type { FactorDetailPublic } from '@/models/factor/dto';

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

export function validateFormForSubmit(form: FactorDetailPublic): string | null {
  if (!form.name.trim()) return '因子标识（name）不能为空';
  const w = form.window;
  if (!Number.isFinite(w) || w < 1) return 'window 须为 >= 1 的整数';
  if ((form.dependencies ?? []).length === 0) return '至少填写一个依赖字段（如 close）';
  if (!form.source.trim()) return '源码不能为空';
  return null;
}

export function bodyFromForm(form: FactorDetailPublic): Record<string, unknown> {
  return {
    name: form.name.trim(),
    group: form.group.trim(),
    description: form.description.trim(),
    window: form.window,
    dependencies: form.dependencies,
    source: form.source,
  };
}
