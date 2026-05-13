import { atom } from 'jotai';
import { atomEffect } from 'jotai-effect';

import { ApiError } from '@/api/client';
import {
  deleteDatasource,
  inspectDatasourceColumns,
  listDatasourcePlugins,
  listDatasources,
  testDatasource,
} from '@/api/datasources';
import { defaultNewName } from '@/lib/default-new-name';
import { createRefreshableAsyncAtoms } from '@/lib/refreshable-async-atoms';
import type { DataSourcePublic, DatasourcePluginPublic } from './dto';
import { commitDatasourceForm } from './commit-datasource';
import { emptyForm, hydrateFormFromDataSource, type FormState } from './form-model';
import {
  computeDatasourcePluginFormSchemas,
  nestDatasourceConfigForApi,
  getDatasourceColumnsConfig,
  type DatasourcePluginFormSchemas,
} from './plugin-form-schemas';

export const datasourcesListAtoms = createRefreshableAsyncAtoms<DataSourcePublic[] | null>({
  initialValue: null,
  fetcher: listDatasources,
});

export const datasourcesBusyIdAtom = atom<string | null>(null);
export const datasourcesTestHintAtom = atom<{ id: string; ok: boolean; message: string } | null>(null);
export const datasourcesSelectedIdAtom = atom<string | null>(null);
export const datasourcesIsEditingAtom = atom<boolean>(false);

/** 数据源详情卡「基础配置 / 字段映射」当前 tab（受控于页面） */
export type DatasourceDetailTab = 'base' | 'fields';
export const datasourcesDetailActiveTabAtom = atom<DatasourceDetailTab>('base');
export const datasourcesDeleteTargetAtom = atom<DataSourcePublic | null>(null);
export const datasourcesDeletingAtom = atom<boolean>(false);
export const datasourcesDeleteErrorAtom = atom<string | null>(null);

export const datasourcesInspectColumnsBusyAtom = atom(false);
export const datasourcesInspectColumnsErrorAtom = atom<string | null>(null);

/** 清除详情区全局提示（删除失败、连接测试、列探测）；在切换选中项、Tab、编辑流等操作后调用 */
export const clearDatasourceTransientAlertsAtom = atom(null, (_get, set) => {
  set(datasourcesDeleteErrorAtom, null);
  set(datasourcesTestHintAtom, null);
  set(datasourcesInspectColumnsErrorAtom, null);
});

/** 右侧编辑器表单（新建/编辑数据源） */
export const datasourcesEditorFormAtom = atom<FormState>(emptyForm());
export const datasourcesPluginsAtom = atom<DatasourcePluginPublic[]>([]);
export const datasourcesEditorFormErrorAtom = atom<string | null>(null);
export const datasourcesEditorSubmittingAtom = atom(false);

/** 左侧列表搜索关键字 */
export const datasourcesListSearchQueryAtom = atom('');

export type DatasourceSearchListRow = {
  id: string;
  label: string;
  description: null;
  category: string;
};

export const datasourcesSearchListRowsAtom = atom((get): DatasourceSearchListRow[] | null => {
  const items = get(datasourcesListAtoms.valueAtom);
  if (!items) return null;
  return items.map((ds) => ({
    id: ds.id,
    label: ds.name,
    description: null,
    category: ds.type,
  }));
});

export const datasourcesListCountAtom = atom((get) => {
  const items = get(datasourcesListAtoms.valueAtom);
  return items?.length ?? 0;
});

export const datasourcesSelectedListItemAtom = atom((get): DataSourcePublic | null => {
  const selectedId = get(datasourcesSelectedIdAtom);
  if (!selectedId) return null;
  const items = get(datasourcesListAtoms.valueAtom);
  return items?.find((d) => d.id === selectedId) ?? null;
});

export const datasourcesPluginFormSchemasAtom = atom((get): DatasourcePluginFormSchemas => {
  const form = get(datasourcesEditorFormAtom);
  const plugins = get(datasourcesPluginsAtom);
  const plugin = plugins.find((p) => p.type === form.type) ?? null;
  return computeDatasourcePluginFormSchemas(form, plugin);
});

const datasourcesSelectedPluginAtom = atom((get): DatasourcePluginPublic | null => {
  const form = get(datasourcesEditorFormAtom);
  const plugins = get(datasourcesPluginsAtom);
  return plugins.find((p) => p.type === form.type) ?? null;
});

/** 插件连接 + 字段映射 RJSF 是否满足 required */
export const datasourcesPluginConfigValidAtom = atom((get) => {
  const form = get(datasourcesEditorFormAtom);
  const plugin = get(datasourcesSelectedPluginAtom);
  if (!plugin) return false;
  const schemas = get(datasourcesPluginFormSchemasAtom);
  const baseRequired = Array.isArray(schemas.baseFormSchema.required)
    ? (schemas.baseFormSchema.required as unknown[])
    : [];
  const fieldsRequired =
    schemas.fieldsFormSchema && Array.isArray(schemas.fieldsFormSchema.required)
      ? (schemas.fieldsFormSchema.required as unknown[])
      : [];
  const connection = (form.config?.connection as Record<string, unknown> | undefined) ?? {};
  const columns = (form.config?.columns as Record<string, unknown> | undefined) ?? {};
  const isFilled = (value: unknown): boolean => {
    if (value == null) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  };
  const baseValid = baseRequired.every((key) => (typeof key === 'string' ? isFilled(connection[key]) : true));
  const fieldsValid = fieldsRequired.every((key) => (typeof key === 'string' ? isFilled(columns[key]) : true));
  return baseValid && fieldsValid;
});

export const datasourcesPluginBaseConfigValidAtom = atom((get) => {
  const form = get(datasourcesEditorFormAtom);
  const plugin = get(datasourcesSelectedPluginAtom);
  if (!plugin) return false;
  const schemas = get(datasourcesPluginFormSchemasAtom);
  const baseRequired = Array.isArray(schemas.baseFormSchema.required)
    ? (schemas.baseFormSchema.required as unknown[])
    : [];
  const connection = (form.config?.connection as Record<string, unknown> | undefined) ?? {};
  const isFilled = (value: unknown): boolean => {
    if (value == null) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  };
  return baseRequired.every((key) => (typeof key === 'string' ? isFilled(connection[key]) : true));
});

export const datasourcesEditorMainFormValidAtom = atom((get) => {
  const form = get(datasourcesEditorFormAtom);
  const isEditing = get(datasourcesIsEditingAtom);
  const selectedId = get(datasourcesSelectedIdAtom);
  return !!form.name.trim() && !(isEditing && !selectedId && !form.type.trim());
});

/**
 * 列探测：读取 {@link datasourcesSelectedIdAtom} 与 {@link datasourcesEditorFormAtom}，
 * 请求 `/datasources/inspect-columns`，成功则把列名与推断的日期/资产列写回表单 config（busy / error 也在此 atom 内维护）。
 */
export const inspectDatasourceColumnsAtom = atom(null, async (get, set): Promise<boolean> => {
  const selectedId = get(datasourcesSelectedIdAtom);
  const form = get(datasourcesEditorFormAtom);
  const { type } = form;
  const config = nestDatasourceConfigForApi(form);

  set(datasourcesInspectColumnsBusyAtom, true);
  set(datasourcesInspectColumnsErrorAtom, null);
  try {
    const resp = await inspectDatasourceColumns({
      ...(selectedId ? { datasource_id: selectedId } : { type }),
      config,
    });
    const cols = Array.from(new Set((resp.columns ?? []).map((x) => String(x).trim()).filter((x) => x.length > 0)));
    if (cols.length === 0) {
      throw new Error('连接成功，但未获取到可用列名');
    }
    set(datasourcesEditorFormAtom, (f) => ({
      ...f,
      config: {
        ...f.config,
        columns: {
          ...getDatasourceColumnsConfig(f),
          columns: cols,
          date_column: resp.date_column,
          asset_column: resp.asset_column,
        },
      },
    }));
    return true;
  } catch (err) {
    const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : String(err);
    set(datasourcesInspectColumnsErrorAtom, msg);
    return false;
  } finally {
    set(datasourcesInspectColumnsBusyAtom, false);
  }
});

/** 从基础配置进入字段映射：先执行列探测，成功则切换到「字段映射」tab。 */
export const datasourceEditorProceedFromBaseTabAtom = atom(null, async (_get, set) => {
  const ok = await set(inspectDatasourceColumnsAtom);
  if (ok) set(datasourcesDetailActiveTabAtom, 'fields');
});

/**
 * 保存右侧编辑器：清空表单错误、置提交中、调用 {@link commitDatasourceForm}、刷新列表、
 * 新建成功时选中新建 id、退出编辑态；失败写入 {@link datasourcesEditorFormErrorAtom}。
 */
export const saveDatasourceEditorAtom = atom(null, async (get, set) => {
  set(clearDatasourceTransientAlertsAtom);
  set(datasourcesEditorFormErrorAtom, null);
  set(datasourcesEditorSubmittingAtom, true);
  try {
    const selectedId = get(datasourcesSelectedIdAtom);
    const isEditing = get(datasourcesIsEditingAtom);
    const isCreate = isEditing && !selectedId;
    const form = get(datasourcesEditorFormAtom);
    const items = get(datasourcesListAtoms.valueAtom);
    const result = await commitDatasourceForm(isCreate ? 'create' : 'edit', selectedId, form, items);
    set(datasourcesListAtoms.refreshAtom);
    // 与 nodes 详情 bump 类似：等列表 async 完成后再退出编辑，避免 sync 读到旧列表导致右侧详情不更新
    await get(datasourcesListAtoms.asyncAtom);
    if (isCreate && result) {
      set(datasourcesSelectedIdAtom, result.id);
    }
    set(datasourcesIsEditingAtom, false);
    return result;
  } catch (err) {
    set(datasourcesEditorFormErrorAtom, err instanceof Error ? err.message : String(err));
  } finally {
    set(datasourcesEditorSubmittingAtom, false);
  }
});

export const confirmDeleteDatasourceAtom = atom(null, async (get, set) => {
  const target = get(datasourcesDeleteTargetAtom);
  if (!target) return;
  set(datasourcesDeletingAtom, true);
  set(datasourcesDeleteErrorAtom, null);
  try {
    await deleteDatasource(target.id);
    set(datasourcesDeleteTargetAtom, null);
    set(datasourcesListAtoms.refreshAtom);
  } catch (e) {
    set(datasourcesDeleteErrorAtom, e instanceof Error ? e.message : String(e));
  } finally {
    set(datasourcesDeletingAtom, false);
  }
});

/** 挂载数据源页时刷新左侧列表 */
export const datasourcesListRefreshOnMountEffectAtom = atomEffect((_get, set) => {
  void set(datasourcesListAtoms.refreshAtom);
});

/** 加载插件目录 → {@link datasourcesPluginsAtom} */
export const datasourcesPluginsCatalogEffectAtom = atomEffect((_get, set) => {
  let cancelled = false;
  void (async () => {
    try {
      const catalog = await listDatasourcePlugins();
      if (!cancelled) set(datasourcesPluginsAtom, catalog);
    } catch {
      if (!cancelled) set(datasourcesPluginsAtom, []);
    }
  })();
  return () => {
    cancelled = true;
  };
});

/** 非编辑态：用列表中的选中项填充右侧表单 */
export const datasourcesSyncViewFormEffectAtom = atomEffect((get, set) => {
  const isEditing = get(datasourcesIsEditingAtom);
  if (isEditing) return;
  const selectedId = get(datasourcesSelectedIdAtom);
  if (!selectedId) return;
  const items = get(datasourcesListAtoms.valueAtom);
  const item = items?.find((d) => d.id === selectedId) ?? null;
  if (!item) return;
  set(datasourcesEditorFormAtom, hydrateFormFromDataSource(item));
});

/** 进入编辑态时拉取详情或初始化新建草稿；退出时复位加载/提交相关 UI 状态 */
export const datasourcesEditorLoadEffectAtom = atomEffect((get, set) => {
  const isEditing = get(datasourcesIsEditingAtom);
  if (!isEditing) {
    set(datasourcesEditorFormErrorAtom, null);
    set(datasourcesEditorSubmittingAtom, false);
    return;
  }
  const selectedId = get(datasourcesSelectedIdAtom);
  const plugins = get(datasourcesPluginsAtom);
  set(datasourcesEditorFormErrorAtom, null);
  // Entering edit mode should not trigger a detail refetch; current form is already synced from selected item.
  if (!selectedId) {
    const nextName = defaultNewName('新数据源');
    set(datasourcesEditorFormAtom, { ...emptyForm(), name: nextName, type: plugins[0]?.type ?? '', config: {} });
  }
});

export const testDatasourceConnectionAtom = atom(null, async (_get, set, datasourceId: string) => {
  set(datasourcesBusyIdAtom, datasourceId);
  set(datasourcesTestHintAtom, null);
  try {
    const r = await testDatasource(datasourceId);
    set(datasourcesTestHintAtom, { id: datasourceId, ok: r.ok, message: r.message });
  } catch (e) {
    const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e);
    set(datasourcesTestHintAtom, { id: datasourceId, ok: false, message: msg });
  } finally {
    set(datasourcesBusyIdAtom, null);
  }
});

export const selectDatasourceFromListAtom = atom(null, (_get, set, itemId: string) => {
  set(clearDatasourceTransientAlertsAtom);
  set(datasourcesSelectedIdAtom, itemId);
  set(datasourcesIsEditingAtom, false);
});

export const startCreateNewDatasourceAtom = atom(null, (_get, set) => {
  set(clearDatasourceTransientAlertsAtom);
  set(datasourcesSelectedIdAtom, null);
  set(datasourcesIsEditingAtom, true);
  set(datasourcesDetailActiveTabAtom, 'base');
});

export const enterDatasourceEditorAtom = atom(null, (_get, set) => {
  set(clearDatasourceTransientAlertsAtom);
  set(datasourcesIsEditingAtom, true);
  set(datasourcesDetailActiveTabAtom, 'base');
});

export const requestDeleteDatasourceAtom = atom(null, (_get, set, item: DataSourcePublic) => {
  set(datasourcesDeleteTargetAtom, item);
});

export const cancelDatasourceEditorAtom = atom(null, (_get, set) => {
  set(clearDatasourceTransientAlertsAtom);
  set(datasourcesEditorFormErrorAtom, null);
  set(datasourcesIsEditingAtom, false);
});

export const dismissDeleteDatasourceDialogAtom = atom(null, (_get, set) => {
  set(datasourcesDeleteTargetAtom, null);
  set(datasourcesDeleteErrorAtom, null);
});
