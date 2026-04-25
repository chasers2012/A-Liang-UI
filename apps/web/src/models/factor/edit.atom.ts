import { atom } from 'jotai';

import { createFactor, deleteFactor, patchFactor } from '@/api/factors';
import type { FactorDetailPublic, FactorParamSpecPublic } from './dto';
import { factorsDefaultSelectedIdAtom } from './browse.atom';
import { factorsDetailAtom, refreshFactorsDetailAtomFamily } from './detail.atom';
import {
  applyFactorDependenciesToSource,
  applyFactorDescriptionToSource,
  applyFactorGroupToSource,
  applyFactorNameToSource,
  applyFactorParamSpecsToSource,
  applyFactorWindowToSource,
  parseFactorDependenciesFromSource,
  parseFactorDescriptionFromSource,
  parseFactorGroupFromSource,
  parseFactorNameFromSource,
  parseFactorParamSpecsFromSource,
  parseFactorWindowFromSource,
  parseUserFactorMetadataFromSource,
} from './factor-metadata-sync';
import { defaultNewFactorName, validateFormForSubmit } from './form-model';
import { refreshFactorsListAtom } from './list-detail.atom';
import { factorsSelectedIdAtom } from './selection.atom';
import { factorTemplateAsyncAtom, factorTemplateAtom } from './template.atom';
import { ensurePythonParser } from './web-tree-sitter-loader';

export const factorsSavingAtom = atom(false);
export const factorsSaveErrorAtom = atom<string | null>(null);

export const factorsSourceDraftAtom = atom<string | undefined>(undefined);
type AtomUpdate<T> = T | ((prev: T) => T);

export const factorsEditNameAtom = atom(
  (get) => {
    const source = get(factorsSourceDraftAtom);
    if (source === undefined) return undefined;
    return parseFactorNameFromSource(source);
  },
  async (get, set, next: AtomUpdate<string | undefined>) => {
    const currentSource = get(factorsSourceDraftAtom);
    if (currentSource === undefined) return;
    const name = typeof next === 'function' ? next(parseFactorNameFromSource(currentSource)) : next;
    if (name === undefined) return;
    const nextSource = await applyFactorNameToSource(currentSource, name);
    if (nextSource === currentSource) return;
    set(factorsSourceDraftAtom, nextSource);
  },
);

export const factorsEditGroupAtom = atom(
  (get) => {
    const source = get(factorsSourceDraftAtom);
    if (source === undefined) return undefined;
    return parseFactorGroupFromSource(source);
  },
  async (get, set, next: AtomUpdate<string | undefined>) => {
    const currentSource = get(factorsSourceDraftAtom);
    if (currentSource === undefined) return;
    const group = typeof next === 'function' ? next(parseFactorGroupFromSource(currentSource)) : next;
    if (group === undefined) return;
    const nextSource = await applyFactorGroupToSource(currentSource, group);
    if (nextSource === currentSource) return;
    set(factorsSourceDraftAtom, nextSource);
  },
);

export const factorsEditDescriptionAtom = atom(
  (get) => {
    const source = get(factorsSourceDraftAtom);
    if (source === undefined) return undefined;
    return parseFactorDescriptionFromSource(source);
  },
  async (get, set, next: AtomUpdate<string | undefined>) => {
    const currentSource = get(factorsSourceDraftAtom);
    if (currentSource === undefined) return;
    const description = typeof next === 'function' ? next(parseFactorDescriptionFromSource(currentSource)) : next;
    if (description === undefined) return;
    const nextSource = await applyFactorDescriptionToSource(currentSource, description);
    if (nextSource === currentSource) return;
    set(factorsSourceDraftAtom, nextSource);
  },
);

export const factorsEditWindowAtom = atom(
  (get) => {
    const source = get(factorsSourceDraftAtom);
    if (source === undefined) return undefined;
    return parseFactorWindowFromSource(source);
  },
  async (get, set, next: AtomUpdate<number | undefined>) => {
    const currentSource = get(factorsSourceDraftAtom);
    if (currentSource === undefined) return;
    const window = typeof next === 'function' ? next(parseFactorWindowFromSource(currentSource)) : next;
    if (window === undefined) return;
    const nextSource = await applyFactorWindowToSource(currentSource, window);
    if (nextSource === currentSource) return;
    set(factorsSourceDraftAtom, nextSource);
  },
);

export const factorsEditDependenciesAtom = atom(
  (get) => {
    const source = get(factorsSourceDraftAtom);
    if (source === undefined) return undefined;
    return parseFactorDependenciesFromSource(source);
  },
  async (get, set, next: AtomUpdate<string[] | undefined>) => {
    const currentSource = get(factorsSourceDraftAtom);
    if (currentSource === undefined) return;
    const dependencies = typeof next === 'function' ? next(parseFactorDependenciesFromSource(currentSource)) : next;
    if (dependencies === undefined) return;
    const nextSource = await applyFactorDependenciesToSource(currentSource, dependencies);
    if (nextSource === currentSource) return;
    set(factorsSourceDraftAtom, nextSource);
  },
);

export const factorsEditParamSpecsAtom = atom(
  (get) => {
    const source = get(factorsSourceDraftAtom);
    if (source === undefined) return undefined;
    return parseFactorParamSpecsFromSource(source);
  },
  async (get, set, next: AtomUpdate<FactorParamSpecPublic[] | undefined>) => {
    const currentSource = get(factorsSourceDraftAtom);
    if (currentSource === undefined) return;
    const paramSpecs = typeof next === 'function' ? next(parseFactorParamSpecsFromSource(currentSource)) : next;
    if (paramSpecs === undefined) return;
    const nextSource = await applyFactorParamSpecsToSource(currentSource, paramSpecs);
    if (nextSource === currentSource) return;
    set(factorsSourceDraftAtom, nextSource);
  },
);

const factorsEditingStateAtom = atom(false);
export const factorsEditingAtom = atom(
  (get) => get(factorsEditingStateAtom),
  async (get, set, next: boolean) => {
    const prev = get(factorsEditingStateAtom);
    if (prev === next) return;

    // Exiting create mode should restore default selection.
    if (!next && get(factorsSelectedIdAtom) == null) {
      set(factorsSelectedIdAtom, get(factorsDefaultSelectedIdAtom));
    }
    set(factorsSaveErrorAtom, null);

    // Entering edit mode: initialize drafts from current visible form (baseForm).
    if (next) {
      await ensurePythonParser();
      const detail = get(factorsDetailAtom);
      const baseForm = detail ?? (await resolveCreateFormForEditing(await get(factorTemplateAsyncAtom)));
      if (baseForm) {
        set(factorsSourceDraftAtom, baseForm.source);
      }
    }

    if (!next) {
      set(factorsSourceDraftAtom, undefined);
    }
    set(factorsEditingStateAtom, next);
  },
);

export const factorsIsPluginFactorAtom = atom((get) => get(factorsDetailAtom)?.is_plugin === true);
export const factorsCanEditAtom = atom((get) => {
  const isPlugin = get(factorsIsPluginFactorAtom);
  return !isPlugin && (get(factorsDetailAtom) != null || get(factorsEditingAtom));
});
export const factorsCanDeleteAtom = atom((get) => {
  const isPlugin = get(factorsIsPluginFactorAtom);
  return !isPlugin && get(factorsSelectedIdAtom) != null && get(factorsDetailAtom) != null;
});
export const creatingAtom = atom(
  (get) => get(factorsEditingAtom) && get(factorsSelectedIdAtom) == null,
  (_get, set, next: boolean) => {
    if (next) {
      set(factorsSelectedIdAtom, null);
      set(factorsSaveErrorAtom, null);
      set(factorsEditingAtom, true);
    } else {
      set(factorsEditingAtom, false);
    }
  },
);

function resolveCreateForm(templateSource: string | null): FactorDetailPublic {
  const nowIso = new Date().toISOString();
  const defaults = {
    id: '__new__',
    group: '未分组',
    description: '',
    is_plugin: false,
    window: 1,
    dependencies: ['close'],
    source: '',
    source_path: '',
    created_at: nowIso,
    updated_at: nowIso,
    name: defaultNewFactorName(),
  };
  let source = '';
  if (templateSource) {
    source = templateSource;
  }
  return {
    ...defaults,
    ...parseUserFactorMetadataFromSource(source),
    source,
    param_specs: parseFactorParamSpecsFromSource(source) ?? [],
  };
}

async function resolveCreateFormForEditing(templateSource: string | null): Promise<FactorDetailPublic> {
  const base = resolveCreateForm(templateSource);
  const source = await applyFactorNameToSource(base.source, base.name);
  return {
    ...base,
    ...parseUserFactorMetadataFromSource(source),
    source,
    param_specs: parseFactorParamSpecsFromSource(source) ?? [],
  };
}

export const factorsVisibleDetailAtom = atom<FactorDetailPublic | null>((get) => {
  const detail = get(factorsDetailAtom);
  const createMode = get(creatingAtom);
  const drafts = {
    name: get(factorsEditNameAtom),
    group: get(factorsEditGroupAtom),
    description: get(factorsEditDescriptionAtom),
    window: get(factorsEditWindowAtom),
    dependencies: get(factorsEditDependenciesAtom),
    source: get(factorsSourceDraftAtom),
    param_specs: get(factorsEditParamSpecsAtom),
  };
  if (!detail && !createMode) return null;
  const baseForm = detail ?? resolveCreateForm(get(factorTemplateAtom));
  const editActive = get(factorsEditingAtom);
  if (!editActive) return baseForm;
  return {
    ...baseForm,
    ...Object.fromEntries(Object.entries(drafts).filter(([, value]) => value !== undefined)),
  };
});

export const handleSaveFactorDetailAtom = atom(null, async (get, set) => {
  if (get(factorsSavingAtom)) return null;
  if (!get(factorsCanEditAtom)) return null;
  const form = get(factorsVisibleDetailAtom);
  if (!form) return null;

  set(factorsSaveErrorAtom, null);
  const validateError = validateFormForSubmit(form);
  if (validateError) {
    set(factorsSaveErrorAtom, validateError);
    return null;
  }

  set(factorsSavingAtom, true);
  try {
    const selectedId = get(factorsSelectedIdAtom);
    const source = get(factorsSourceDraftAtom) ?? form.source;
    const saved = selectedId == null ? await createFactor(source) : await patchFactor(selectedId, source);
    await set(refreshFactorsListAtom);
    if (selectedId != null) {
      await set(refreshFactorsDetailAtomFamily(selectedId));
    }
    set(factorsEditingAtom, false);
    set(factorsSelectedIdAtom, saved.id);
    return saved.id;
  } catch (e) {
    set(factorsSaveErrorAtom, e instanceof Error ? e.message : String(e));
    return null;
  } finally {
    set(factorsSavingAtom, false);
  }
});

export const handleDeleteFactorAtom = atom(null, async (get, set) => {
  if (!get(factorsCanDeleteAtom)) return false;
  if (get(factorsIsPluginFactorAtom)) return false;
  const selectedId = get(factorsSelectedIdAtom);
  if (!selectedId) return false;
  await deleteFactor(selectedId);
  await set(refreshFactorsListAtom);
  set(factorsEditingAtom, false);
  set(factorsSelectedIdAtom, null);
  return true;
});
