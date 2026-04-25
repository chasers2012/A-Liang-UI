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
  if (!form.source.trim()) return '源码不能为空';
  return null;
}
