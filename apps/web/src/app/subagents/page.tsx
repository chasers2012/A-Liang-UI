'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';

import { EmptyState, SearchListEmpty, resolveAsyncListEmptyState } from '@/components/empty-state';
import { Page } from '@/components/page';
import { SearchList, SearchListItem } from '@/components/search-list';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  refreshSubagentToolConfigsAtom,
  subagentSavingAtomFamily,
  subagentToolConfigAtoms,
  updateSubagentToolsAtom,
} from '@/models/subagents';

function firstLine(raw: string): string {
  return (raw || '').split('\n')[0]?.trim() || '';
}

function SubagentDetailPanel({
  config,
  tools,
}: {
  config: {
    subagent_id: string;
    title: string;
    description: string;
    default_tool_ids: string[];
    tool_ids: string[];
  };
  tools: Array<{ id: string; name: string; description: string; loaded: boolean }>;
}) {
  const isSaving = useAtomValue(subagentSavingAtomFamily(config.subagent_id));
  const updateSubagentTools = useSetAtom(updateSubagentToolsAtom);
  const selected = new Set(config.tool_ids);
  return (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">{config.title}</h3>
        <p className="text-sm text-muted-foreground">{config.description}</p>
      </div>
      <ul className="space-y-2">
        {tools.map((tool) => {
          const checked = selected.has(tool.id);
          return (
            <li key={tool.id} className="flex items-start gap-2 rounded-md border px-3 py-2">
              <Checkbox
                checked={checked}
                disabled={isSaving}
                onCheckedChange={(nextChecked) => {
                  const next = new Set(selected);
                  if (nextChecked) next.add(tool.id);
                  else next.delete(tool.id);
                  void updateSubagentTools({
                    subagentId: config.subagent_id,
                    toolIds: Array.from(next),
                  });
                }}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate font-mono text-sm">{tool.name || tool.id}</div>
                <div className="text-xs text-muted-foreground line-clamp-2">
                  {firstLine(tool.description) || (tool.loaded ? '已加载' : '未加载')}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="text-xs text-muted-foreground">
        默认工具数：{config.default_tool_ids.length}，当前启用：{config.tool_ids.length}
      </div>
    </section>
  );
}

export default function SubagentsPage() {
  const loading = useAtomValue(subagentToolConfigAtoms.loadingAtom);
  const error = useAtomValue(subagentToolConfigAtoms.errorAtom);
  const data = useAtomValue(subagentToolConfigAtoms.valueAtom);
  const refresh = useSetAtom(refreshSubagentToolConfigsAtom);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const effectiveSelectedId = useMemo(() => {
    if (!data?.subagents.length) return null;
    if (selectedId && data.subagents.some((item) => item.subagent_id === selectedId)) {
      return selectedId;
    }
    return data.subagents[0]?.subagent_id ?? null;
  }, [data, selectedId]);

  const selectedConfig = useMemo(
    () => data?.subagents.find((item) => item.subagent_id === effectiveSelectedId) ?? null,
    [data, effectiveSelectedId],
  );

  const subagentsSearchListEmpty = resolveAsyncListEmptyState({
    loading,
    error: error ?? null,
    itemCount: data?.subagents.length ?? 0,
    emptyTitle: '暂无子代理配置',
    emptyDescription: '请先在服务端配置子代理。',
    loadingTitle: '加载中',
  });

  return (
    <Page size="full" gap="sm" className="flex h-full min-h-0 w-full flex-row overflow-hidden">
      <SearchList
        className="h-full min-h-0 w-[300px]"
        items={
          data?.subagents.map((item) => ({
            id: item.subagent_id,
            label: item.title,
            description: item.description,
            selectedCount: item.tool_ids.length,
          })) ?? null
        }
        searchKeys={['label', 'description']}
        title="子代理列表"
        searchPlaceholder="搜索子代理"
        selectedId={effectiveSelectedId}
        renderItem={({ item, selectedId }) => (
          <SearchListItem
            item={item}
            selectedId={selectedId}
            title={item.label}
            description={`${item.description}（已启用 ${item.selectedCount} 个工具）`}
            onClick={() => setSelectedId(item.id)}
          />
        )}
      >
        <SearchListEmpty {...subagentsSearchListEmpty} />
      </SearchList>

      <Card className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto p-4">
        {loading ? (
          <EmptyState variant="loading" title="加载中" description="正在加载子代理配置…" />
        ) : error ? (
          <Alert variant="destructive">
            <AlertTitle>加载失败</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : !selectedConfig ? (
          <Alert>
            <AlertDescription>请从左侧选择一个子代理。</AlertDescription>
          </Alert>
        ) : (
          <SubagentDetailPanel config={selectedConfig} tools={data?.tools ?? []} />
        )}
      </Card>
    </Page>
  );
}
