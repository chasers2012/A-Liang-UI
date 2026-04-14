'use client';

import { useAtomValue, useSetAtom } from 'jotai';
import { Combobox } from '@base-ui/react/combobox';
import { Check, Funnel, Plus, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useMemo, useState, type ReactNode } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WorkflowNodeTypeList } from '@/components/workflow-graph/workflow-node-type-list';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Page } from '@/components/page';
import { useEffectMicrotask } from '@/hooks/use-effect-microtask';
import { cn } from '@/lib/utils';
import { listNodeVisibilityConfigs } from '@/api/nodes';
import type { NodeSummaryPublic } from '@/models/nodes/dto';
import { refreshNodesListAtom, nodesListAtom } from '@/models/nodes/list-detail.atom';
import {
  categoryLabel,
  clearNodesCategoryFiltersAtom,
  filteredNodesAtom,
  nodesBrowseStateAtom,
  nodesCategoryOptionKeysAtom,
  nodesDefaultSelectedIdAtom,
  nodesFilterPopoverActiveAtom,
  nodesIncludedCategoriesSetAtom,
  parseNodesDetailRouteId,
  resetNodesBrowseFiltersAtom,
  setNodesSearchQueryAtom,
  setNodesSourceFilterAtom,
  toggleNodesCategoryFilterAtom,
  type NodesSourceFilter,
} from '@/models/nodes/browse.atom';

/** 供 `/nodes` 首页右侧预览区读取与左侧列表一致的选中项（筛选后）。 */
export const NodesBrowseSelectionContext = createContext<string | null>(null);
const DOMAIN_ALL_PLACEHOLDER = '不限（全部领域）';

const domainComboboxInputClassName = cn(
  'min-w-[6rem] flex-1 border-0 bg-transparent py-0.5 pl-1 text-sm outline-none',
  'text-foreground placeholder:text-muted-foreground',
  'focus-visible:outline-none',
  'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
);

const domainComboboxInputGroupClassName = cn(
  'flex min-h-8 w-full flex-wrap items-center gap-0.5 rounded-lg border border-input bg-transparent px-1.5 py-1',
  'outline-none transition-colors',
  'focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50',
  'dark:bg-input/30',
);

const domainChipClassName = cn(
  'flex items-center gap-0.5 rounded-md bg-muted px-1.5 py-0.5 text-xs text-foreground',
  'outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground',
);

const domainComboboxItemClassName = cn(
  'flex cursor-default items-start gap-2 px-2.5 py-1.5 text-sm outline-none select-none',
  'data-[highlighted]:relative data-[highlighted]:z-0 data-[highlighted]:text-accent-foreground',
  'data-[highlighted]:before:absolute data-[highlighted]:before:inset-x-1 data-[highlighted]:before:inset-y-0.5 data-[highlighted]:before:z-[-1]',
  'data-[highlighted]:before:rounded-md data-[highlighted]:before:bg-accent',
);

function getNodesEffectiveSelectedId(params: {
  pathname: string;
  selectedDomains: string[];
  defaultSelectedId: string | null;
  domainDefaultSelectedId: string | null;
}): string | null {
  const { pathname, selectedDomains, defaultSelectedId, domainDefaultSelectedId } = params;
  if (pathname !== '/nodes') return null;
  if (selectedDomains.length === 0) return defaultSelectedId;
  return domainDefaultSelectedId;
}

function NodesListFilterPopover(props: {
  filterPopoverActive: boolean;
  sourceFilter: NodesSourceFilter;
  setSourceFilter: (v: NodesSourceFilter) => void;
  domainOptions: string[];
  selectedDomains: string[];
  setSelectedDomains: (v: string[]) => void;
  categoryOptionKeys: string[];
  includedCategories: Set<string>;
  toggleCategoryFilter: (key: string) => void;
  clearCategoryFilters: () => void;
  resetListFilters: () => void;
}) {
  const {
    filterPopoverActive,
    sourceFilter,
    setSourceFilter,
    domainOptions,
    selectedDomains,
    setSelectedDomains,
    categoryOptionKeys,
    includedCategories,
    toggleCategoryFilter,
    clearCategoryFilters,
    resetListFilters,
  } = props;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="relative" aria-label="筛选节点">
          <Funnel />
          {filterPopoverActive ? (
            <span className="absolute right-1 top-1 size-2 rounded-full bg-primary" aria-hidden />
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end" sideOffset={8}>
        <PopoverHeader>
          <PopoverTitle>筛选</PopoverTitle>
          <PopoverDescription>按来源、领域与分类缩小列表；分类不勾选表示不限。</PopoverDescription>
        </PopoverHeader>
        <div className="mt-3 space-y-4">
          <div>
            <div className="mb-2 text-xs font-medium text-muted-foreground">来源</div>
            <div className="flex flex-wrap gap-1">
              <Button
                type="button"
                variant={sourceFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setSourceFilter('all')}
              >
                全部
              </Button>
              <Button
                type="button"
                variant={sourceFilter === 'user' ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setSourceFilter('user')}
              >
                用户节点
              </Button>
              <Button
                type="button"
                variant={sourceFilter === 'plugin' ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setSourceFilter('plugin')}
              >
                插件节点
              </Button>
            </div>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">领域</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground"
                onClick={() => setSelectedDomains([])}
              >
                清除领域条件
              </Button>
            </div>
            <Combobox.Root
              items={domainOptions}
              multiple
              value={selectedDomains}
              onValueChange={(v) => setSelectedDomains(v ?? [])}
              openOnInputClick
            >
              <Combobox.InputGroup className={domainComboboxInputGroupClassName}>
                <Combobox.Chips className="flex w-full min-w-0 flex-wrap items-center gap-0.5">
                  <Combobox.Value>
                    {(value: string[]) => (
                      <>
                        {value.map((domain) => (
                          <Combobox.Chip key={domain} className={domainChipClassName} aria-label={`移除 ${domain}`}>
                            {domain}
                            <Combobox.ChipRemove
                              type="button"
                              className="rounded p-0.5 text-muted-foreground hover:bg-background/80 hover:text-foreground"
                              aria-label="移除"
                            >
                              <X className="size-3" aria-hidden />
                            </Combobox.ChipRemove>
                          </Combobox.Chip>
                        ))}
                        <Combobox.Input
                          placeholder={value.length > 0 ? '添加更多…' : DOMAIN_ALL_PLACEHOLDER}
                          autoComplete="off"
                          className={domainComboboxInputClassName}
                        />
                      </>
                    )}
                  </Combobox.Value>
                </Combobox.Chips>
              </Combobox.InputGroup>

              <Combobox.Portal>
                <Combobox.Positioner className="z-50 outline-none" sideOffset={4} align="start">
                  <Combobox.Popup
                    className={cn(
                      'max-h-[min(16rem,var(--available-height))] min-w-(--anchor-width) w-max max-w-[min(28rem,var(--available-width))]',
                      'origin-(--transform-origin) overflow-y-auto overscroll-contain rounded-md border border-border bg-popover py-1 text-popover-foreground shadow-md',
                    )}
                  >
                    <Combobox.Empty className="px-2.5 py-2 text-sm text-muted-foreground">无匹配领域</Combobox.Empty>
                    <Combobox.List className="outline-none">
                      {(item: string) => (
                        <Combobox.Item key={item} value={item} className={domainComboboxItemClassName}>
                          <Combobox.ItemIndicator className="mt-0.5 flex shrink-0 justify-center">
                            <Check className="size-3.5" aria-hidden />
                          </Combobox.ItemIndicator>
                          <span className="min-w-0 flex-1 whitespace-normal wrap-break-word">{item}</span>
                        </Combobox.Item>
                      )}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
            {domainOptions.length === 0 ? (
              <div className="mt-2 text-xs text-muted-foreground">
                暂无领域配置（可在后端先创建 `/nodes/node-visibility/{'{domain}'}` 配置）
              </div>
            ) : null}
          </div>
          {categoryOptionKeys.length > 0 ? (
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">分类</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground"
                  onClick={clearCategoryFilters}
                >
                  清除分类条件
                </Button>
              </div>
              <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
                {categoryOptionKeys.map((key) => (
                  <label key={key} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 shrink-0 rounded border border-input accent-primary"
                      checked={includedCategories.size === 0 ? false : includedCategories.has(key)}
                      onChange={() => toggleCategoryFilter(key)}
                    />
                    <span className="truncate">{categoryLabel(key)}</span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}
          <div className="flex justify-end border-t pt-3">
            <Button type="button" variant="outline" size="sm" className="h-8" onClick={resetListFilters}>
              重置筛选
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function NodesLayoutClient({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { items, error } = useAtomValue(nodesListAtom);
  const refresh = useSetAtom(refreshNodesListAtom);
  const { searchQuery, sourceFilter } = useAtomValue(nodesBrowseStateAtom);
  const includedCategories = useAtomValue(nodesIncludedCategoriesSetAtom);
  const categoryOptionKeys = useAtomValue(nodesCategoryOptionKeysAtom);
  const filteredItems = useAtomValue(filteredNodesAtom);
  const filterPopoverActive = useAtomValue(nodesFilterPopoverActiveAtom);
  const defaultSelectedId = useAtomValue(nodesDefaultSelectedIdAtom);
  const setSearchQuery = useSetAtom(setNodesSearchQueryAtom);
  const setSourceFilter = useSetAtom(setNodesSourceFilterAtom);
  const toggleCategoryFilter = useSetAtom(toggleNodesCategoryFilterAtom);
  const clearCategoryFilters = useSetAtom(clearNodesCategoryFiltersAtom);
  const resetListFilters = useSetAtom(resetNodesBrowseFiltersAtom);
  const [domainConfigs, setDomainConfigs] = useState<Record<string, Set<string>>>({});
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);

  useEffectMicrotask(() => {
    void refresh();
  }, [refresh]);
  useEffectMicrotask(() => {
    void (async () => {
      try {
        const rows = await listNodeVisibilityConfigs();
        const next: Record<string, Set<string>> = {};
        for (const row of rows) {
          next[row.domain] = new Set(row.hidden_node_ids);
        }
        setDomainConfigs(next);
      } catch {
        setDomainConfigs({});
      }
    })();
  }, []);

  const routeDetailId = parseNodesDetailRouteId(pathname);
  const domainOptions = useMemo(
    () => Object.keys(domainConfigs).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN')),
    [domainConfigs],
  );
  const domainFilteredItems = useMemo(() => {
    if (!filteredItems) return null;
    if (selectedDomains.length === 0) return filteredItems;
    return filteredItems.filter((m: NodeSummaryPublic) => {
      return selectedDomains.some((domain) => {
        const hidden = domainConfigs[domain];
        if (!hidden) return true;
        return !hidden.has(m.id);
      });
    });
  }, [domainConfigs, filteredItems, selectedDomains]);

  /** `/nodes` 无 URL id 时，右侧与列表高亮均对齐当前筛选结果的第一条。 */
  const effectiveDefaultSelectedId = domainFilteredItems?.[0]?.id ?? null;
  const effectiveSelectedId = getNodesEffectiveSelectedId({
    pathname,
    selectedDomains,
    defaultSelectedId,
    domainDefaultSelectedId: effectiveDefaultSelectedId,
  });

  const highlightId = routeDetailId ?? (pathname === '/nodes' ? effectiveSelectedId : null);

  const filterActive = filterPopoverActive || selectedDomains.length > 0;

  const onSelectNode = (id: string) => {
    router.push(`/nodes/${encodeURIComponent(id)}`);
  };

  return (
    <Page size="full" gap="sm" className="flex h-full min-h-0 w-full flex-row overflow-hidden">
      <WorkflowNodeTypeList
        className="h-full min-h-0 w-[300px]"
        items={
          domainFilteredItems?.map((m) => ({
            type: m.id,
            label: m.name,
            description: m.description,
            category: m.category,
          })) ?? null
        }
        selectedType={highlightId}
        searchPlaceholder="搜索节点"
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        emptyText={
          (items?.length ?? 0) === 0 ? '暂无节点。请使用上方「新增节点」开始配置。' : '没有符合当前筛选条件的节点。'
        }
        onSelectType={onSelectNode}
        toolbarRight={
          <>
            <NodesListFilterPopover
              filterPopoverActive={filterActive}
              sourceFilter={sourceFilter}
              setSourceFilter={setSourceFilter}
              domainOptions={domainOptions}
              selectedDomains={selectedDomains}
              setSelectedDomains={setSelectedDomains}
              categoryOptionKeys={categoryOptionKeys}
              includedCategories={includedCategories}
              toggleCategoryFilter={toggleCategoryFilter}
              clearCategoryFilters={() => clearCategoryFilters()}
              resetListFilters={() => {
                resetListFilters();
                setSelectedDomains([]);
              }}
            />
            <Link
              href="/nodes/new"
              aria-label="新增节点"
              className={cn(buttonVariants({ variant: 'default', size: 'icon' }))}
            >
              <Plus />
            </Link>
          </>
        }
      />

      <Card className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <NodesBrowseSelectionContext.Provider value={effectiveSelectedId}>
          {children}
        </NodesBrowseSelectionContext.Provider>
      </Card>
    </Page>
  );
}

export default function NodesLayout({ children }: { children: ReactNode }) {
  return <NodesLayoutClient>{children}</NodesLayoutClient>;
}
