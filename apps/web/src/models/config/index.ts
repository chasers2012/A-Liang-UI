import { atom } from 'jotai';
import { atomEffect } from 'jotai-effect';
import type { RJSFSchema, UiSchema } from '@rjsf/utils';

import { ApiError } from '@/api/client';
import { getConfig, getConfigSpecs, putConfig } from '@/api/config';
import { createRefreshableAsyncAtoms } from '@/lib/refreshable-async-atoms';
import type { ConfigModuleSpecPublic } from './dto';

export type { ConfigModuleSpecPublic, ConfigSpecsResponse, ConfigValuesResponse } from './dto';

export type ConfigModuleView = {
  spec: ConfigModuleSpecPublic;
  schema: RJSFSchema;
  uiSchema: UiSchema;
  loading: boolean;
  saving: boolean;
  loadError: string | null;
  saveError: string | null;
  saveSuccess: string | null;
};

function toErrorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : err instanceof Error ? err.message : String(err);
}

function toSchema(spec: ConfigModuleSpecPublic): RJSFSchema {
  return spec.schema as RJSFSchema;
}

function toUiSchema(spec: ConfigModuleSpecPublic, disabled: boolean): UiSchema {
  return {
    ...(spec.uiSchema as UiSchema),
    'ui:disabled': disabled,
  };
}

const specsAtoms = createRefreshableAsyncAtoms<ConfigModuleSpecPublic[]>({
  initialValue: [],
  fetcher: async () => {
    const resp = await getConfigSpecs();
    return resp.items;
  },
});

export const configSpecsValueAtom = specsAtoms.valueAtom;
export const configSpecsLoadingAtom = specsAtoms.loadingAtom;
export const configSpecsErrorAtom = specsAtoms.errorAtom;
export const refreshConfigSpecsAtom = specsAtoms.refreshAtom;

const moduleAtoms = new Map<string, ReturnType<typeof createRefreshableAsyncAtoms<Record<string, unknown>>>>();
const moduleSavingAtoms = new Map<string, ReturnType<typeof atom<boolean>>>();
const moduleSaveErrorAtoms = new Map<string, ReturnType<typeof atom<string | null>>>();
const moduleSaveSuccessAtoms = new Map<string, ReturnType<typeof atom<string | null>>>();

function getOrCreateAtom<T>(store: Map<string, ReturnType<typeof atom<T>>>, moduleKey: string, initialValue: T) {
  const existing = store.get(moduleKey);
  if (existing) return existing;
  const created = atom(initialValue);
  store.set(moduleKey, created);
  return created;
}

function getModuleAtoms(moduleKey: string) {
  const existing = moduleAtoms.get(moduleKey);
  if (existing) return existing;

  const created = createRefreshableAsyncAtoms<Record<string, unknown>>({
    initialValue: {},
    fetcher: async () => {
      const resp = await getConfig(moduleKey);
      return resp.values;
    },
  });
  moduleAtoms.set(moduleKey, created);
  return created;
}

export function getConfigModuleAtoms(moduleKey: string) {
  return getModuleAtoms(moduleKey);
}

function getModuleUiAtoms(moduleKey: string) {
  return {
    savingAtom: getOrCreateAtom(moduleSavingAtoms, moduleKey, false),
    saveErrorAtom: getOrCreateAtom(moduleSaveErrorAtoms, moduleKey, null),
    saveSuccessAtom: getOrCreateAtom(moduleSaveSuccessAtoms, moduleKey, null),
  } as const;
}

export const configPageStateAtom = atom((get) => {
  const specs = get(configSpecsValueAtom);
  const specsLoading = get(configSpecsLoadingAtom);
  const specsError = get(configSpecsErrorAtom);

  const modules: ConfigModuleView[] = specs.map((spec) => {
    const atoms = getModuleAtoms(spec.key);
    const uiAtoms = getModuleUiAtoms(spec.key);
    const loading = get(atoms.loadingAtom);
    const saving = get(uiAtoms.savingAtom);

    return {
      spec,
      schema: toSchema(spec),
      uiSchema: toUiSchema(spec, loading || saving),
      loading,
      saving,
      loadError: get(atoms.errorAtom),
      saveError: get(uiAtoms.saveErrorAtom),
      saveSuccess: get(uiAtoms.saveSuccessAtom),
    };
  });

  const showEmpty = !specsLoading && !specsError && specs.length === 0;

  return { specs, specsLoading, specsError, showEmpty, modules };
});

/** 进入配置页时拉取模块定义；各模块 values 在 configPageStateAtom 订阅后自动拉取 */
export const configPageRefreshOnMountEffectAtom = atomEffect((_get, set) => {
  void set(refreshConfigSpecsAtom);
});

export const refreshConfigPageAtom = atom(null, (get, set) => {
  set(refreshConfigSpecsAtom);
  for (const spec of get(configSpecsValueAtom)) {
    set(getModuleAtoms(spec.key).refreshAtom);
  }
});

export const saveConfigModuleAtom = atom(null, async (get, set, moduleKey: string) => {
  const atoms = getModuleAtoms(moduleKey);
  const uiAtoms = getModuleUiAtoms(moduleKey);
  const currentValues = get(atoms.valueAtom);

  set(uiAtoms.savingAtom, true);
  set(uiAtoms.saveErrorAtom, null);
  set(uiAtoms.saveSuccessAtom, null);

  try {
    const resp = await putConfig(moduleKey, currentValues);
    set(atoms.valueAtom, resp.values);
    set(uiAtoms.saveSuccessAtom, '已保存。');
    return resp.values;
  } catch (err) {
    const message = toErrorMessage(err);
    set(uiAtoms.saveErrorAtom, message);
    throw new Error(message);
  } finally {
    set(uiAtoms.savingAtom, false);
  }
});
