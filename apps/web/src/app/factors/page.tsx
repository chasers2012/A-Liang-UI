'use client';

import { createContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { Plus } from 'lucide-react';

import { createFactor, deleteFactor, getFactor, getFactorTemplate, patchFactor } from '@/api/factors';
import { Page } from '@/components/page';
import { SearchList } from '@/components/search-list';
import { buttonVariants } from '@/components/ui/button';
import { useEffectMicrotask } from '@/hooks/use-effect-microtask';
import { cn } from '@/lib/utils';
import { factorsListAtom, refreshFactorsListAtom } from '@/models/factor';
import type { FactorSummaryPublic } from '@/models/factor/dto';
import {
  bodyFromForm,
  defaultNewFactorName,
  emptyForm,
  hydrateFromDetail,
  validateFormForSubmit,
  type FactorFormState,
} from '@/models/factor';
import { applyFactorFormPatch } from './ui/factor-form-fields';
import { Card } from '@/components/ui/card';
import { Item, ItemContent } from '@/components/ui/item';
import { FactorDetailPanel } from './components/panel/factor-detail-panel';

/** 供 `/factors` 右侧详情区读取与左侧列表一致的选中项（默认首项）。 */
export const FactorsLibrarySelectionContext = createContext<string | null>(null);

function FactorEditor(props: {
  factorId: string | null;
  readonly: boolean;
  saveVersion: number;
  onSavingChange: (next: boolean) => void;
  onSaved: () => void;
  onCreated: (id: string) => void;
  children: (ctx: {
    form: FactorFormState;
    setForm: (next: FactorFormState | ((prev: FactorFormState) => FactorFormState)) => void;
    formError: string | null;
  }) => ReactNode;
}) {
  const { factorId, readonly, saveVersion, onSavingChange, onSaved, onCreated, children } = props;
  const isCreateMode = !factorId;
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<FactorFormState>(emptyForm());
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setFormError(null);
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

  useEffect(() => {
    onSavingChange(saving);
  }, [onSavingChange, saving]);

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
      onSaved();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (saveVersion <= 0) return;
    void onSave();
    // saveVersion 仅用于触发保存动作，不应把 onSave 作为依赖导致重复触发
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveVersion]);

  if (!factorId && readonly) {
    return (
      <Item variant="outline">
        <ItemContent>
          <p className="text-sm text-muted-foreground">请选择左侧因子后查看详情。</p>
        </ItemContent>
      </Item>
    );
  }

  if (loading) {
    return (
      <Item variant="outline">
        <ItemContent>
          <p className="text-sm text-muted-foreground">详情加载中…</p>
        </ItemContent>
      </Item>
    );
  }

  if (loadError) {
    return (
      <Item variant="outline">
        <ItemContent>
          <p className="text-sm text-destructive">详情加载失败：{loadError}</p>
        </ItemContent>
      </Item>
    );
  }

  if (!hasLoaded) return null;

  return <>{children({ form, setForm, formError })}</>;
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

export default function FactorsPage() {
  const [detailTabValue, setDetailTabValue] = useState('overview');
  const { items, error: loadError } = useAtomValue(factorsListAtom);
  const refresh = useSetAtom(refreshFactorsListAtom);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [sourceSaving, setSourceSaving] = useState(false);
  const [sourceSaveVersion, setSourceSaveVersion] = useState(0);

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
  const isCreating = editing && selectedId === null;

  const selectedFactor = useMemo(() => {
    if (!selectedId) return null;
    return items?.find((m) => m.id === selectedId);
  }, [selectedId, items]);

  const onSelectFactor = (id: string) => {
    setEditing(false);
    setSelectedId(id);
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
              setSelectedId(null);
              setEditing(true);
              setDetailTabValue('overview');
            }}
          >
            <Plus />
          </button>
        }
      />
      <FactorsLibrarySelectionContext.Provider value={selectedId}>
        <Card className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <FactorEditor
            factorId={selectedId}
            readonly={!editing}
            saveVersion={sourceSaveVersion}
            onSavingChange={setSourceSaving}
            onSaved={() => {
              setEditing(false);
              void refresh();
            }}
            onCreated={(id) => {
              setEditing(false);
              setSelectedId(id);
              setDetailTabValue('overview');
            }}
          >
            {({ form, setForm, formError }) => (
              <FactorDetailPanel
                detailTabValue={detailTabValue}
                setDetailTabValue={setDetailTabValue}
                form={form}
                setForm={setForm}
                formError={formError}
                editing={editing}
                isCreating={isCreating}
                sourceSaving={sourceSaving}
                selectedId={selectedId}
                onCancelCreate={() => {
                  setEditing(false);
                  setSelectedId(effectiveDefaultSelectedId);
                  setDetailTabValue('overview');
                }}
                onCreate={() => {
                  setSourceSaveVersion((v) => v + 1);
                }}
                onCancelEdit={() => {
                  setEditing(false);
                }}
                onSave={() => {
                  setSourceSaveVersion((v) => v + 1);
                }}
                onDelete={() => {
                  if (!selectedId) return;
                  void deleteSelectedFactor({
                    selectedId,
                    selectedName: selectedFactor?.name ?? selectedId,
                    refresh,
                    onDeleted: () => setSelectedId(null),
                  });
                }}
                onEdit={() => {
                  setDetailTabValue('overview');
                  setSelectedId(selectedId ?? effectiveDefaultSelectedId);
                  setEditing(true);
                }}
              />
            )}
          </FactorEditor>
        </Card>
      </FactorsLibrarySelectionContext.Provider>
    </Page>
  );
}
