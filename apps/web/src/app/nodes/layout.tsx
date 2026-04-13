"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { Funnel, Plus, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, type ReactNode } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Page } from "@/components/page";
import { useEffectMicrotask } from "@/hooks/use-effect-microtask";
import { cn } from "@/lib/utils";
import {
  refreshNodesListAtom,
  nodesListAtom,
} from "@/models/nodes/list-detail.atom";
import type { NodeSummaryPublic } from "@/models/nodes/dto";
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
} from "@/models/nodes/browse.atom";

/** 供 `/nodes` 首页右侧预览区读取与左侧列表一致的选中项（筛选后）。 */
export const NodesBrowseSelectionContext = createContext<string | null>(null);

const NODE_PAGE_CARD_TOOLBAR =
  "flex w-full shrink-0 flex-row items-center justify-between gap-2 border-b px-4 pb-3 pt-0";

function NodesListFilterPopover(props: {
  filterPopoverActive: boolean;
  sourceFilter: NodesSourceFilter;
  setSourceFilter: (v: NodesSourceFilter) => void;
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
    categoryOptionKeys,
    includedCategories,
    toggleCategoryFilter,
    clearCategoryFilters,
    resetListFilters,
  } = props;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="筛选节点"
        >
          <Funnel />
          {filterPopoverActive ? (
            <span
              className="absolute right-1 top-1 size-2 rounded-full bg-primary"
              aria-hidden
            />
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end" sideOffset={8}>
        <PopoverHeader>
          <PopoverTitle>筛选</PopoverTitle>
          <PopoverDescription>
            按来源与分类缩小列表；分类不勾选表示不限。
          </PopoverDescription>
        </PopoverHeader>
        <div className="mt-3 space-y-4">
          <div>
            <div className="mb-2 text-xs font-medium text-muted-foreground">
              来源
            </div>
            <div className="flex flex-wrap gap-1">
              <Button
                type="button"
                variant={sourceFilter === "all" ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setSourceFilter("all")}
              >
                全部
              </Button>
              <Button
                type="button"
                variant={sourceFilter === "user" ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setSourceFilter("user")}
              >
                用户节点
              </Button>
              <Button
                type="button"
                variant={sourceFilter === "plugin" ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setSourceFilter("plugin")}
              >
                插件节点
              </Button>
            </div>
          </div>
          {categoryOptionKeys.length > 0 ? (
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  分类
                </span>
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
                  <label
                    key={key}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      className="size-4 shrink-0 rounded border border-input accent-primary"
                      checked={
                        includedCategories.size === 0
                          ? false
                          : includedCategories.has(key)
                      }
                      onChange={() => toggleCategoryFilter(key)}
                    />
                    <span className="truncate">{categoryLabel(key)}</span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}
          <div className="flex justify-end border-t pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              onClick={resetListFilters}
            >
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

  useEffectMicrotask(() => {
    void refresh();
  }, [refresh]);

  const routeDetailId = parseNodesDetailRouteId(pathname);

  /** `/nodes` 无 URL id 时，右侧与列表高亮均对齐当前筛选结果的第一条。 */
  const effectiveSelectedId = pathname === "/nodes" ? defaultSelectedId : null;

  const highlightId =
    routeDetailId ?? (pathname === "/nodes" ? effectiveSelectedId : null);

  const onSelectNode = (m: NodeSummaryPublic) => {
    router.push(`/nodes/${encodeURIComponent(m.id)}`);
  };

  return (
    <Page
      size="full"
      gap="sm"
      className="flex h-full min-h-0 w-full flex-row overflow-hidden"
    >
      <Card className="h-full min-h-0 w-[300px]">
        <CardHeader className="shrink-0">
          <CardTitle>节点列表</CardTitle>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
          <div className={NODE_PAGE_CARD_TOOLBAR}>
            <InputGroup className="max-w-xs">
              <InputGroupInput
                placeholder="搜索"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="搜索节点"
              />
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
            </InputGroup>
            <div className="flex flex-row justify-end gap-1">
              <NodesListFilterPopover
                filterPopoverActive={filterPopoverActive}
                sourceFilter={sourceFilter}
                setSourceFilter={setSourceFilter}
                categoryOptionKeys={categoryOptionKeys}
                includedCategories={includedCategories}
                toggleCategoryFilter={toggleCategoryFilter}
                clearCategoryFilters={() => clearCategoryFilters()}
                resetListFilters={resetListFilters}
              />
              <Link
                href="/nodes/new"
                aria-label="新增节点"
                className={cn(
                  buttonVariants({ variant: "default", size: "icon" }),
                )}
              >
                <Plus />
              </Link>
            </div>
          </div>
          <div className="min-h-0 w-full flex-1 pl-3 pr-1 overflow-y-auto overflow-x-hidden">
            <div className="flex flex-col gap-1 py-2">

              {!filteredItems ? (
                error ? (
                  <Alert variant="destructive">
                    <AlertTitle>加载失败</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                ) : <p className="p-6 text-sm text-muted-foreground">加载中…</p>
              ) : filteredItems.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">
                  {(items?.length ?? 0) === 0
                    ? "暂无节点。请使用上方「新增节点」开始配置。"
                    : "没有符合当前筛选条件的节点。"}
                </p>
              ) : (
                filteredItems.map((m) => (
                  <Item
                    key={m.id}
                    variant="outline"
                    className={cn({
                      "border-primary bg-muted/50 ring-1 ring-primary/35":
                        m.id === highlightId,
                    })}
                    render={
                      <div
                        role="button"
                        tabIndex={0}
                        className="w-full cursor-pointer text-left outline-none"
                        onClick={() => onSelectNode(m)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onSelectNode(m);
                          }
                        }}
                      />
                    }
                  >
                    <ItemContent className="overflow-hidden">
                      <ItemTitle>{m.name}</ItemTitle>
                      <ItemDescription>{m.description || "—"}</ItemDescription>
                    </ItemContent>
                  </Item>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <NodesBrowseSelectionContext.Provider value={effectiveSelectedId}>
          {children}
        </NodesBrowseSelectionContext.Provider>
      </Card>
    </Page >
  );
}

export default function NodesLayout({ children }: { children: ReactNode }) {
  return <NodesLayoutClient>{children}</NodesLayoutClient>;
}
