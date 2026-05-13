'use client';

import * as React from 'react';
import { NavigationGuardLink } from '@/components/navigation-guard-link';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { cn } from '@/lib/utils';

export type PageBreadcrumbItem = {
  href?: string;
  label: string;
};

/** 通用面包屑；末项无 href 表示当前页 */
export const PageBreadcrumb = React.memo(function PageBreadcrumb({
  items,
  variant = 'default',
}: {
  items: PageBreadcrumbItem[];
  /** header：顶栏用大号字号 */
  variant?: 'default' | 'header';
}) {
  if (items.length === 0) return null;
  const header = variant === 'header';
  return (
    <Breadcrumb aria-label="面包屑" className="min-w-0 flex-1 -ml-0.5">
      <BreadcrumbList className={cn(header ? 'gap-2 text-base md:text-lg leading-snug' : 'gap-1 text-sm')}>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const hasLink = item.href != null && item.href !== '' && !isLast;
          return (
            <React.Fragment key={`${index}-${item.label}`}>
              {index > 0 ? (
                <BreadcrumbSeparator
                  className={cn(
                    'shrink-0 text-muted-foreground/50',
                    header ? '[&>svg]:size-4 md:[&>svg]:size-4.5' : '[&>svg]:size-3.5',
                  )}
                />
              ) : null}
              <BreadcrumbItem className="max-w-full min-w-0">
                {hasLink ? (
                  <BreadcrumbLink
                    render={<NavigationGuardLink href={item.href!} />}
                    className={cn(
                      'truncate rounded-md px-0.5 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      header && 'font-medium',
                    )}
                  >
                    {item.label}
                  </BreadcrumbLink>
                ) : isLast ? (
                  <BreadcrumbPage
                    className={cn(
                      'truncate px-0.5 py-0.5',
                      header ? 'text-lg font-semibold md:text-xl' : 'font-medium',
                    )}
                  >
                    {item.label}
                  </BreadcrumbPage>
                ) : (
                  <span className="truncate px-0.5 py-0.5">{item.label}</span>
                )}
              </BreadcrumbItem>
            </React.Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
});
