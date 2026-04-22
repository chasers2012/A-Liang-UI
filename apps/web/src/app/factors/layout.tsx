'use client';

import { createContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { Plus } from 'lucide-react';

import { createFactor, deleteFactor, getFactor, getFactorTemplate, patchFactor } from '@/api/factors';
import { Page } from '@/components/page';
import { SearchList } from '@/components/search-list';
import { Button, buttonVariants } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useEffectMicrotask } from '@/hooks/use-effect-microtask';
import { cn } from '@/lib/utils';
import { factorsListAtom, refreshFactorsListAtom } from '@/models/factor';
import type { FactorSummaryPublic } from '@/models/factor/dto';
import { Frame, FrameHeader, FramePanel, FrameTitle } from '@/components/reui/frame';
import {
  bodyFromForm,
  defaultNewFactorName,
  emptyForm,
  hydrateFromDetail,
  validateFormForSubmit,
  type FactorFormState,
} from '@/models/factor';
import { applyFactorFormPatch, FactorFormFields } from './ui/factor-form-fields';
import { FactorEvaluationTrigger } from './ui/factor-evaluation-trigger';
import { FactorEvaluationResult } from './ui/factor-evaluation-result';

/** 供 `/factors` 右侧详情区读取与左侧列表一致的选中项（默认首项）。 */
export const FactorsLibrarySelectionContext = createContext<string | null>(null);

function FactorSourceEditor(props: {
  factorId: string | null;
  isCreateMode: boolean;
  onSaved: () => void;
  onCreated: (id: string) => void;
}) {
  const { factorId, isCreateMode, onSaved, onCreated } = props;
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<FactorFormState>(emptyForm());
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setFormError(null);
    setEditMode(isCreateMode);
    void (async () => {
      try {
        if (isCreateMode) {
          const source = await getFactorTemplate();
          if (cancelled) return;
          const next = applyFactorFormPatch(emptyForm(), {
            source,
            name: defaultNewFactorName(),
          });
          setForm(next);
          setHasLoaded(true);
          return;
        }
        if (!factorId) {
          setHasLoaded(false);
          setLoadError(null);
          return;
        }
        const detail = await getFactor(factorId);
        if (cancelled) return;
        setForm(hydrateFromDetail(detail));
        setHasLoaded(true);
      } catch (e) {
        if (cancelled) return;
        setHasLoaded(false);
        setLoadError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [factorId, isCreateMode]);

  const onSave = async () => {
    setFormError(null);
    const validateError = validateFormForSubmit(form);
    if (validateError) {
      setFormError(validateError);
      return;
    }
    setSaving(true);
    try {
      if (isCreateMode) {
        const created = await createFactor(bodyFromForm(form));
        setForm(hydrateFromDetail(created));
        onSaved();
        onCreated(created.id);
        return;
      }
      if (!factorId) return;
      const saved = await patchFactor(factorId, bodyFromForm(form));
      setForm(hydrateFromDetail(saved));
      setEditMode(false);
      onSaved();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  if (!isCreateMode && !factorId) {
    return (
      <FramePanel>
        <p className="text-sm text-muted-foreground">请选择左侧因子后查看源码。</p>
      </FramePanel>
    );
  }

  if (loading) {
    return (
      <FramePanel>
        <p className="text-sm text-muted-foreground">源码加载中…</p>
      </FramePanel>
    );
  }

  if (loadError) {
    return (
      <FramePanel>
        <p className="text-sm text-destructive">源码加载失败：{loadError}</p>
      </FramePanel>
    );
  }

  if (!hasLoaded) return null;

  return (
    <FramePanel className="space-y-4 overflow-auto">
      <div className="flex items-center justify-end gap-2">
        {isCreateMode ? (
          <Button onClick={() => void onSave()} disabled={saving}>
            {saving ? '创建中…' : '创建因子'}
          </Button>
        ) : !editMode ? (
          <Button onClick={() => setEditMode(true)}>编辑源码</Button>
        ) : (
          <>
            <Button variant="outline" onClick={() => setEditMode(false)} disabled={saving}>
              取消
            </Button>
            <Button onClick={() => void onSave()} disabled={saving}>
              {saving ? '保存中…' : '保存'}
            </Button>
          </>
        )}
      </div>
      <FactorFormFields
        form={form}
        setForm={setForm}
        formError={formError}
        readOnly={!isCreateMode && !editMode}
        idPrefix={`factor-source-${factorId ?? 'new'}`}
      />
    </FramePanel>
  );
}

async function deleteSelectedFactor(params: {
  selectedId: string;
  selectedName: string;
  refresh: () => Promise<void>;
  onDeleted: () => void;
}) {
  const { selectedId, selectedName, refresh, onDeleted } = params;
  if (!window.confirm(`确定删除因子「${selectedName}」吗？`)) return;
  try {
    await deleteFactor(selectedId);
    await refresh();
    onDeleted();
  } catch (e) {
    window.alert(e instanceof Error ? e.message : String(e));
  }
}

// eslint-disable-next-line complexity
export default function FactorsLayout({ children }: { children: ReactNode }) {
  void children;
  const [detailTabValue, setDetailTabValue] = useState('overview');
  const { items, error: loadError } = useAtomValue(factorsListAtom);
  const refresh = useSetAtom(refreshFactorsListAtom);
  const [selectedIdState, setSelectedIdState] = useState<string | null>(null);
  const [createMode, setCreateMode] = useState(false);

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

  const effectiveDefaultSelectedId = filteredItems?.[0]?.id ?? null;
  const selectedId = createMode ? null : (selectedIdState ?? effectiveDefaultSelectedId);

  const selectedFactor = useMemo(() => {
    if (!selectedId) return null;
    return items?.find((m) => m.id === selectedId);
  }, [selectedId, items]);

  const onSelectFactor = (id: string) => {
    setCreateMode(false);
    setSelectedIdState(id);
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
        selectedId={selectedId}
        emptyText={
          loadError
            ? '因子列表加载失败。'
            : (items?.length ?? 0) === 0
              ? '暂无因子。请使用右上角「新增因子」创建。'
              : '没有符合当前筛选条件的因子。'
        }
        onItemSelected={(item) => onSelectFactor(item.id)}
        toolbarRight={
          <button
            type="button"
            aria-label="新增因子"
            className={cn(buttonVariants({ variant: 'default', size: 'icon' }))}
            onClick={() => {
              setCreateMode(true);
              setDetailTabValue('source');
            }}
          >
            <Plus />
          </button>
        }
      />
      <FactorsLibrarySelectionContext.Provider value={selectedId}>
        <Frame className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <Tabs value={detailTabValue} onValueChange={setDetailTabValue}>
            <FrameHeader>
              <FrameTitle>{selectedFactor?.name || '因子详情'}</FrameTitle>
              <div className="flex flex-row justify-between">
                <div className="flex">
                  <TabsList className="inline-flex h-9 w-fit flex-wrap items-center gap-1 rounded-lg bg-muted/80 p-1 text-muted-foreground">
                    <TabsTrigger value="overview">概览</TabsTrigger>
                    <TabsTrigger value="source">源码</TabsTrigger>
                  </TabsList>
                </div>
                <div className="flex">
                  <Button
                    disabled={!selectedId && !createMode}
                    onClick={() => {
                      setDetailTabValue('source');
                    }}
                  >
                    编辑
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={!selectedId || createMode}
                    onClick={() => {
                      if (!selectedId) return;
                      void deleteSelectedFactor({
                        selectedId,
                        selectedName: selectedFactor?.name ?? selectedId,
                        refresh,
                        onDeleted: () => setSelectedIdState(null),
                      });
                    }}
                  >
                    删除
                  </Button>
                </div>
              </div>
            </FrameHeader>
            <TabsContent
              value="overview"
              className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden outline-none data-hidden:hidden"
            >
              {selectedId && (
                <>
                  <FramePanel>
                    <h2 className="text-sm">因子简介</h2>
                    <p className="text-muted-foreground text-sm">{selectedFactor?.description || '暂无简介'}</p>
                  </FramePanel>
                  <FramePanel>
                    <h2 className="text-sm">因子评价</h2>
                    <FactorEvaluationTrigger factorId={selectedId} onRunEvaluation={function (): void {}} />
                  </FramePanel>
                  <FramePanel>
                    <h2 className="text-sm">评价结果</h2>
                    <FactorEvaluationResult factorId={selectedId} />
                  </FramePanel>
                </>
              )}
            </TabsContent>

            <TabsContent
              value="source"
              className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden outline-none data-hidden:hidden"
            >
              <FactorSourceEditor
                factorId={selectedId}
                isCreateMode={createMode}
                onSaved={() => void refresh()}
                onCreated={(id) => {
                  setCreateMode(false);
                  setSelectedIdState(id);
                  setDetailTabValue('source');
                }}
              />
            </TabsContent>
          </Tabs>
        </Frame>
      </FactorsLibrarySelectionContext.Provider>
    </Page>
  );
}
