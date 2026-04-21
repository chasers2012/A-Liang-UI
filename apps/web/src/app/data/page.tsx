import Link from 'next/link';
import type { Metadata } from 'next';

import { Page } from '@/components/page';
import { buttonVariants } from '@/components/ui/button';
import { SIDEBAR_NAV } from '@/lib/app-navigation';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: '数据',
};

export default function DataSectionPage() {
  const data = SIDEBAR_NAV.find((p) => p.url === '/data');
  const items = data?.items ?? [];
  if (!items.length) return null;

  return (
    <Page title="数据" description="与侧栏「数据」分组一致：数据源与数据集。" gap="sm">
      <ul className="grid max-w-md gap-2">
        {items.map((item) => {
          const SubIcon = item.icon!;
          return (
            <li key={item.url}>
              <Link
                href={item.url}
                className={cn(
                  buttonVariants({ variant: 'outline' }),
                  'flex w-full items-center justify-start gap-2 py-6',
                )}
              >
                <SubIcon className="size-4 shrink-0" aria-hidden />
                {item.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </Page>
  );
}
