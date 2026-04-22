'use client';

import { Funnel } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from '@/components/ui/combobox';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { categoryLabel, type NodesSourceFilter } from '@/models/nodes/browse.atom';

const DOMAIN_ALL_PLACEHOLDER = '不限（全部领域）';

const domainComboboxInputClassName = cn('text-sm placeholder:text-muted-foreground');

const domainChipClassName = cn('text-xs');

const domainComboboxItemClassName = cn('items-start text-sm');

export function NodesListFilterPopover(props: {
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

  const domainAnchor = useComboboxAnchor();

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
            <Combobox
              items={domainOptions}
              multiple
              value={selectedDomains}
              onValueChange={(v) => setSelectedDomains(v ?? [])}
              openOnInputClick
            >
              <ComboboxChips ref={domainAnchor} className="w-full min-w-0">
                <ComboboxValue>
                  {(value: string[]) => (
                    <>
                      {value.map((domain) => (
                        <ComboboxChip key={domain} className={domainChipClassName} aria-label={`移除 ${domain}`}>
                          {domain}
                        </ComboboxChip>
                      ))}
                      <ComboboxChipsInput
                        placeholder={value.length > 0 ? '添加更多…' : DOMAIN_ALL_PLACEHOLDER}
                        autoComplete="off"
                        className={domainComboboxInputClassName}
                      />
                    </>
                  )}
                </ComboboxValue>
              </ComboboxChips>

              <ComboboxContent
                anchor={domainAnchor}
                sideOffset={4}
                align="start"
                className="w-max max-w-[min(28rem,var(--available-width))]"
              >
                <ComboboxEmpty className="px-2.5 py-2 text-sm text-muted-foreground">无匹配领域</ComboboxEmpty>
                <ComboboxList className="outline-none">
                  {(item: string) => (
                    <ComboboxItem key={item} value={item} className={domainComboboxItemClassName}>
                      <span className="min-w-0 flex-1 whitespace-normal wrap-break-word">{item}</span>
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
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
