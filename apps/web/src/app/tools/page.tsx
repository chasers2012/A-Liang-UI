'use client';

import { useEffect } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';

import type { ToolRecord } from '@/api/tools';
import { Page } from '@/components/page';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  refreshToolsAtom,
  toolSavingAtomFamily,
  toolsCategoryGroupsAtom,
  toolsListAtoms,
  updateToolAuthorizationAtom,
} from '@/models/tools';
import { SectionHeader } from '@/components/section-header';

const AUTH_OPTIONS: Array<{ value: ToolRecord['authorization']; label: string }> = [
  { value: 'disabled', label: '禁用' },
  { value: 'need authorize', label: '需授权' },
  { value: 'allowed', label: '允许' },
];

function authorizationLabel(value: ToolRecord['authorization']): string {
  const found = AUTH_OPTIONS.find((opt) => opt.value === value);
  return found?.label ?? value;
}

function authorizationDotClass(value: ToolRecord['authorization']): string {
  if (value === 'disabled') return 'bg-gray-500/80';
  if (value === 'need authorize') return 'bg-yellow-500/80';
  return 'bg-green-500/80';
}

function descriptionFirstLine(raw: string): string {
  return (raw || '').split('\n')[0]?.trim() || '';
}

function ToolItemRow({ tool }: { tool: ToolRecord }) {
  const isSaving = useAtomValue(toolSavingAtomFamily(tool.id));
  const updateAuthorization = useSetAtom(updateToolAuthorizationAtom);
  return (
    <li className="relative flex items-center gap-3 px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${authorizationDotClass(tool.authorization)}`}
            aria-label={`权限状态：${authorizationLabel(tool.authorization)}`}
            title={`权限状态：${authorizationLabel(tool.authorization)}`}
          />
          <div className="font-mono text-sm truncate min-w-0">{tool.name || tool.id}</div>
        </div>
        <div className="ml-4 mt-1">
          {descriptionFirstLine(tool.description) ? (
            <div className="text-xs text-muted-foreground line-clamp-2">{descriptionFirstLine(tool.description)}</div>
          ) : (
            <div className="text-xs text-muted-foreground">{tool.loaded ? '已加载' : '未加载'}</div>
          )}
        </div>
      </div>
      <Select
        value={tool.authorization}
        onValueChange={async (v) => {
          await updateAuthorization({
            toolId: tool.id,
            next: v as ToolRecord['authorization'],
          });
        }}
        disabled={isSaving}
      >
        <SelectTrigger size="sm" className="w-22">
          <SelectValue placeholder="选择权限">{authorizationLabel(tool.authorization)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {AUTH_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </li>
  );
}

function ToolCategoryCard({ group }: { group: { category: string; items: ToolRecord[] } }) {
  const grouped = group.items;
  return (
    <>
      <SectionHeader>{group.category}</SectionHeader>
      <ul className="divide-y rounded-lg border bg-card mb-7">
        {grouped.map((t) => (
          <ToolItemRow key={t.id} tool={t} />
        ))}
      </ul>
    </>
  );
}

export default function ToolsPage() {
  const loading = useAtomValue(toolsListAtoms.loadingAtom);
  const error = useAtomValue(toolsListAtoms.errorAtom);
  const categoryGroups = useAtomValue(toolsCategoryGroupsAtom);
  const refresh = useSetAtom(refreshToolsAtom);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <Page title="Tools" description="查看和管理工具权限。">
      <div className="min-w-0">
        <section className="space-y-4">
          {loading ? (
            <Alert>
              <AlertTitle>加载中</AlertTitle>
              <AlertDescription>正在加载工具列表…</AlertDescription>
            </Alert>
          ) : error ? (
            <Alert variant="destructive">
              <AlertTitle>加载失败</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : categoryGroups.length ? (
            <div className="space-y-4">
              {categoryGroups.map((group) => (
                <ToolCategoryCard key={group.category} group={group} />
              ))}
            </div>
          ) : (
            <Alert>
              <AlertDescription>暂无</AlertDescription>
            </Alert>
          )}
        </section>
      </div>
    </Page>
  );
}
