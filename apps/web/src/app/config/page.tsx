'use client';

import { useAtom, useAtomValue } from 'jotai';
import { useLayoutEffect } from 'react';

import { SearchListEmpty, resolveAsyncListEmptyState } from '@/components/empty-state';
import { CollapsibleSidebar } from '@/components/collapsible-sidebar';
import { Page } from '@/components/page';
import { SearchList, SearchListItem } from '@/components/search-list';
import { configPageRefreshOnMountEffectAtom, configPageStateAtom } from '@/models/config';
import { configSelectedModuleKeyAtom } from '@/models/config/selection.atom';

import { ConfigModuleDetailPanel } from './components/config-module-detail-panel';

export default function AgentConfigPage() {
  const { specsLoading, specsError, modules } = useAtomValue(configPageStateAtom);
  const [selectedKey, setSelectedKey] = useAtom(configSelectedModuleKeyAtom);
  useAtom(configPageRefreshOnMountEffectAtom);

  useLayoutEffect(() => {
    if (specsLoading || modules.length === 0) return;
    if (selectedKey == null || !modules.some((m) => m.spec.key === selectedKey)) {
      setSelectedKey(modules[0].spec.key);
    }
  }, [modules, selectedKey, specsLoading, setSelectedKey]);

  const configSearchListEmpty = resolveAsyncListEmptyState({
    loading: specsLoading,
    error: specsError ? `配置模块列表加载失败：${specsError}` : null,
    itemCount: modules.length,
    emptyTitle: '暂无可配置模块',
    emptyDescription: '后端未返回可编辑的配置定义。',
    filterEmptyDescription: '没有符合搜索条件的配置模块。',
  });

  const sidebarItems = specsLoading
    ? null
    : modules.map((m) => ({
        id: m.spec.key,
        label: m.spec.title,
        description: m.spec.description ?? '',
      }));

  return (
    <Page size="full" gap="sm" className="flex h-full min-h-0 w-full flex-row overflow-hidden">
      <CollapsibleSidebar collapsed={false} drawerTitle="配置">
        <SearchList
          className="h-full min-h-0"
          items={sidebarItems}
          searchKeys={['label', 'description', 'id']}
          title="配置模块"
          searchPlaceholder="搜索配置模块"
          selectedId={selectedKey}
          renderItem={({ item, selectedId }) => (
            <SearchListItem
              item={item}
              selectedId={selectedId}
              title={item.label}
              description={item.description}
              onClick={() => setSelectedKey(item.id)}
            />
          )}
        >
          <SearchListEmpty {...configSearchListEmpty} />
        </SearchList>
      </CollapsibleSidebar>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <ConfigModuleDetailPanel />
      </div>
    </Page>
  );
}
