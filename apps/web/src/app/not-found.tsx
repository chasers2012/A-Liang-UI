import Link from 'next/link';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function NotFound() {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">页面不存在或不可用</h1>
      <p className="max-w-md text-sm text-muted-foreground">该地址可能已移除，或当前部署已通过功能开关禁用此模块。</p>
      <Link href="/" className={cn(buttonVariants({ variant: 'default' }))}>
        返回首页
      </Link>
    </div>
  );
}
