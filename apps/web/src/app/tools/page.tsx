'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { listTools, setToolAuthorization, type ToolRecord } from '@/api/tools';
import { Page } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; data: ToolRecord[] };

function uniqSorted(items: string[]): string[] {
  return Array.from(new Set(items.map((s) => s.trim()).filter(Boolean))).sort();
}

function displayCategory(raw: string): string {
  const c = (raw || '').trim();
  if (!c) return 'Other';
  return c;
}

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
  if (value === 'disabled') return 'border-t-gray-500/80';
  if (value === 'need authorize') return 'border-t-yellow-500/80';
  return 'border-t-green-500/80';
}

function descriptionFirstLine(raw: string): string {
  return (raw || '').split('\n')[0]?.trim() || '';
}

export default function ToolsPage() {
  const [state, setState] = useState<LoadState>({ kind: 'idle' });
  const [saving, setSaving] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const data = await listTools();
      setState({
        kind: 'ready',
        data: data.slice().sort((a, b) => a.id.localeCompare(b.id)),
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : '加载失败';
      setState({ kind: 'error', message });
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const view = useMemo(() => {
    if (state.kind === 'loading' || state.kind === 'idle') {
      return <div className="text-sm text-muted-foreground">加载中…</div>;
    }
    if (state.kind === 'error') {
      return (
        <div className="space-y-2">
          <div className="text-sm text-destructive">{state.message}</div>
          <Button type="button" variant="outline" onClick={refresh}>
            重试
          </Button>
        </div>
      );
    }

    const items = state.data;
    const categories = uniqSorted(items.map((t) => displayCategory(t.category)));
    const itemsByCategory = new Map<string, ToolRecord[]>();
    for (const t of items) {
      const c = displayCategory(t.category);
      const arr = itemsByCategory.get(c);
      if (arr) arr.push(t);
      else itemsByCategory.set(c, [t]);
    }
    for (const arr of itemsByCategory.values()) {
      arr.sort((a, b) => a.id.localeCompare(b.id));
    }

    return (
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">工具列表</h2>
          <Button type="button" variant="outline" onClick={refresh}>
            刷新
          </Button>
        </div>
        {items.length ? (
          <div className="space-y-4">
            {categories.map((cat) => {
              const grouped = itemsByCategory.get(cat) ?? [];
              return (
                <div key={cat} className="rounded-lg border bg-card">
                  <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{cat}</div>
                      <div className="text-xs text-muted-foreground">{grouped.length} 个</div>
                    </div>
                  </div>
                  <ul className="divide-y">
                    {grouped.map((t) => {
                      const isSaving = saving === t.id;
                      return (
                        <li key={t.id} className="relative flex items-center gap-3 px-3 py-2 pl-4">
                          <span
                            className={`absolute left-0 top-0 h-0 w-0 border-r-10 border-t-10 border-r-transparent ${authorizationDotClass(
                              t.authorization,
                            )}`}
                            aria-label={`权限状态：${authorizationLabel(t.authorization)}`}
                            title={`权限状态：${authorizationLabel(t.authorization)}`}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="font-mono text-sm truncate">{t.name || t.id}</div>
                            {descriptionFirstLine(t.description) ? (
                              <div className="text-xs text-muted-foreground line-clamp-2">
                                {descriptionFirstLine(t.description)}
                              </div>
                            ) : (
                              <div className="text-xs text-muted-foreground">{t.loaded ? '已加载' : '未加载'}</div>
                            )}
                          </div>
                          <Select
                            value={t.authorization}
                            onValueChange={async (v) => {
                              const next = v as ToolRecord['authorization'];
                              if (next === t.authorization) return;
                              setSaving(t.id);
                              try {
                                await setToolAuthorization(t.id, next);
                                await refresh();
                              } finally {
                                setSaving(null);
                              }
                            }}
                            disabled={isSaving}
                          >
                            <SelectTrigger size="sm" className="w-22">
                              <SelectValue placeholder="选择权限">{authorizationLabel(t.authorization)}</SelectValue>
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
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border bg-card px-3 py-6 text-sm text-muted-foreground">暂无</div>
        )}
      </section>
    );
  }, [refresh, saving, state]);

  return (
    <Page title="Tools" description="查看 tools 列表。">
      <div className="min-w-0">{view}</div>
    </Page>
  );
}
