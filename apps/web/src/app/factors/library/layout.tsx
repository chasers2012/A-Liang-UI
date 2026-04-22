'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useMemo, useState, type ReactNode } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { Plus } from 'lucide-react';

import { Page } from '@/components/page';
import { SearchList } from '@/components/search-list';
import { Card } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { useEffectMicrotask } from '@/hooks/use-effect-microtask';
import { cn } from '@/lib/utils';
import { factorsListAtom, refreshFactorsListAtom } from '@/models/factor';
import type { FactorSummaryPublic } from '@/models/factor/dto';

/** 供 `/factors/library` 右侧详情区读取与左侧列表一致的选中项（无 URL id 时默认首项）。 */
export const FactorsLibrarySelectionContext = createContext<string | null>(null);

function parseFactorsLibraryRouteId(pathname: string): string | null {
  if (!pathname.startsWith('/factors/library')) return null;
  const rest = pathname.slice('/factors/library'.length);
  if (!rest || rest === '/') return null;
  const seg = rest.replace(/^\//, '').split('/')[0] ?? '';
  if (!seg) return null;
  if (seg === 'new') return null;
  return decodeURIComponent(seg);
}

function getFactorsLibraryEffectiveSelectedId(params: {
  pathname: string;
  defaultSelectedId: string | null;
}): string | null {
  const { pathname, defaultSelectedId } = params;
  if (pathname !== '/factors/library') return null;
  return defaultSelectedId;
}

export function FactorsLibraryLayoutClient({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const { items, error: loadError } = useAtomValue(factorsListAtom);
  const refresh = useSetAtom(refreshFactorsListAtom);

  useEffectMicrotask(() => {
    void refresh();
  }, [refresh]);

  const [searchQuery, setSearchQuery] = useState('');

  const filteredItems = useMemo(() => {
    if (!items) return null;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter((m: FactorSummaryPublic) => {
      const text = [m.name, m.description, m.group, m.id].join(' ').toLowerCase();
      return text.includes(q);
    });
  }, [items, searchQuery]);

  const routeDetailId = parseFactorsLibraryRouteId(pathname);
  const effectiveDefaultSelectedId = filteredItems?.[0]?.id ?? null;
  const effectiveSelectedId = getFactorsLibraryEffectiveSelectedId({
    pathname,
    defaultSelectedId: effectiveDefaultSelectedId,
  });

  const highlightId = routeDetailId ?? (pathname === '/factors/library' ? effectiveSelectedId : null);

  const onSelectFactor = (id: string) => {
    router.push(`/factors/library/${encodeURIComponent(id)}`);
  };

  return (
    <Page size="full" gap="sm" className="flex h-full min-h-0 w-full flex-row overflow-hidden">
      <SearchList
        className="h-full min-h-0 w-[320px]"
        items={
          filteredItems?.map((m) => ({
            id: m.id,
            label: m.name,
            description: m.description,
            category: m.group,
          })) ?? null
        }
        getGroupKey={(item) => item.category ?? '未分组'}
        renderTitle={(item) => item.label}
        renderDescription={(item) => item.description ?? ''}
        getSearchText={(item) => [item.label, item.description ?? '', item.category ?? '', item.id].join(' ')}
        title="因子列表"
        searchPlaceholder="搜索因子"
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        selectedId={highlightId}
        emptyText={
          loadError
            ? '因子列表加载失败。'
            : (items?.length ?? 0) === 0
              ? '暂无因子。请使用右上角「新增因子」创建。'
              : '没有符合当前筛选条件的因子。'
        }
        onItemSelected={(item) => onSelectFactor(item.id)}
        toolbarRight={
          <Link
            href="/factors/library/new"
            aria-label="新增因子"
            className={cn(buttonVariants({ variant: 'default', size: 'icon' }))}
          >
            <Plus />
          </Link>
        }
      />

      <Card className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <FactorsLibrarySelectionContext.Provider value={effectiveSelectedId}>
          {children}
        </FactorsLibrarySelectionContext.Provider>
      </Card>
    </Page>
  );
}

export default function FactorsLibraryLayout({ children }: { children: ReactNode }) {
  return <FactorsLibraryLayoutClient>{children}</FactorsLibraryLayoutClient>;
}
