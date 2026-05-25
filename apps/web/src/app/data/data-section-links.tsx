'use client';

import { NavigationGuardLink } from '@/components/navigation-guard-link';
import { buttonVariants } from '@/components/ui/button';
import { getNav } from '@/routes';
import { cn } from '@/lib/utils';

export function DataSectionLinks() {
  const data = getNav().find((p) => p.url === '/data');
  const items = data?.items ?? [];
  if (!items.length) return null;

  return (
    <ul className="grid max-w-md gap-2">
      {items.map((item) => {
        const SubIcon = item.icon!;
        return (
          <li key={item.url}>
            <NavigationGuardLink
              href={item.url}
              className={cn(
                buttonVariants({ variant: 'outline' }),
                'flex w-full items-center justify-start gap-2 py-6',
              )}
            >
              <SubIcon className="size-4 shrink-0" aria-hidden />
              {item.title}
            </NavigationGuardLink>
          </li>
        );
      })}
    </ul>
  );
}
