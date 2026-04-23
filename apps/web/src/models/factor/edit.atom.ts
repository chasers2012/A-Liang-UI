import { atom } from 'jotai';
import { withAtomEffect } from 'jotai-effect';

import { createFactor, deleteFactor, patchFactor } from '@/api/factors';
import type { FactorDetailPublic } from './dto';
import { factorsDefaultSelectedIdAtom } from './browse.atom';
import { factorsDetailAtom, refreshFactorsDetailAtomFamily } from './detail.atom';
import {
  applyFactorDependenciesToSource,
  applyFactorDescriptionToSource,
  applyFactorGroupToSource,
  applyFactorNameToSource,
  applyFactorWindowToSource,
  parseFactorDependenciesFromSource,
  parseFactorDescriptionFromSource,
  parseFactorGroupFromSource,
  parseFactorNameFromSource,
  parseFactorWindowFromSource,
  parseUserFactorMetadataFromSource,
} from './factor-metadata-sync';
import { bodyFromForm, defaultNewFactorName, validateFormForSubmit } from './form-model';
import { refreshFactorsListAtom } from './list-detail.atom';
import { factorsSelectedIdAtom } from './selection.atom';
import { factorTemplateAtom } from './template.atom';

export const factorsSavingAtom = atom(false);
export const factorsSaveErrorAtom = atom<string | null>(null);

export const factorsSourceDraftAtom = withAtomEffect(atom<string | undefined>(undefined), (get, set) => {
  const sourceDraft = get(factorsSourceDraftAtom);
  if (!get(factorsEditingAtom)) return;
  if (sourceDraft === undefined) return;

  const name = parseFactorNameFromSource(sourceDraft);
  if (name !== get(factorsEditNameAtom)) set(factorsEditNameAtom, name);

  const group = parseFactorGroupFromSource(sourceDraft);
  if (group !== get(factorsEditGroupAtom)) set(factorsEditGroupAtom, group);

  const description = parseFactorDescriptionFromSource(sourceDraft);
  if (description !== get(factorsEditDescriptionAtom)) set(factorsEditDescriptionAtom, description);

  const window = parseFactorWindowFromSource(sourceDraft);
  if (window !== get(factorsEditWindowAtom)) set(factorsEditWindowAtom, window);

  const dependencies = parseFactorDependenciesFromSource(sourceDraft);
  const prevDeps = get(factorsEditDependenciesAtom);
  const depsEqual =
    dependencies === prevDeps ||
    (dependencies !== undefined &&
      prevDeps !== undefined &&
      dependencies.length === prevDeps.length &&
      dependencies.every((d, i) => d === prevDeps[i]));
  if (!depsEqual) set(factorsEditDependenciesAtom, dependencies);
});

export const factorsEditNameAtom = withAtomEffect(atom<string | undefined>(undefined), (get, set) => {
  const name = get(factorsEditNameAtom);
  if (!get(factorsEditingAtom)) return;
  const currentSource = get(factorsSourceDraftAtom);
  if (currentSource === undefined || name === undefined) return;
  const nextSource = applyFactorNameToSource(currentSource, name);
  if (nextSource === currentSource) return;
  set(factorsSourceDraftAtom, nextSource);
});
export const factorsEditGroupAtom = withAtomEffect(atom<string | undefined>(undefined), (get, set) => {
  const group = get(factorsEditGroupAtom);
  if (!get(factorsEditingAtom)) return;
  const currentSource = get(factorsSourceDraftAtom);
  if (currentSource === undefined || group === undefined) return;
  const nextSource = applyFactorGroupToSource(currentSource, group);
  if (nextSource === currentSource) return;
  set(factorsSourceDraftAtom, nextSource);
});
export const factorsEditDescriptionAtom = withAtomEffect(atom<string | undefined>(undefined), (get, set) => {
  const description = get(factorsEditDescriptionAtom);
  if (!get(factorsEditingAtom)) return;
  const currentSource = get(factorsSourceDraftAtom);
  if (currentSource === undefined || description === undefined) return;
  const nextSource = applyFactorDescriptionToSource(currentSource, description);
  if (nextSource === currentSource) return;
  set(factorsSourceDraftAtom, nextSource);
});
export const factorsEditWindowAtom = withAtomEffect(atom<number | undefined>(undefined), (get, set) => {
  const window = get(factorsEditWindowAtom);
  if (!get(factorsEditingAtom)) return;
  const currentSource = get(factorsSourceDraftAtom);
  if (currentSource === undefined || window === undefined) return;
  const nextSource = applyFactorWindowToSource(currentSource, window);
  if (nextSource === currentSource) return;
  set(factorsSourceDraftAtom, nextSource);
});
export const factorsEditDependenciesAtom = withAtomEffect(atom<string[] | undefined>(undefined), (get, set) => {
  const dependencies = get(factorsEditDependenciesAtom);
  if (!get(factorsEditingAtom)) return;
  const currentSource = get(factorsSourceDraftAtom);
  if (currentSource === undefined || dependencies === undefined) return;
  const nextSource = applyFactorDependenciesToSource(currentSource, dependencies);
  if (nextSource === currentSource) return;
  set(factorsSourceDraftAtom, nextSource);
});

const factorsEditingStateAtom = atom(false);
export const factorsEditingAtom = atom(
  (get) => get(factorsEditingStateAtom),
  (get, set, next: boolean) => {
    // Exiting create mode should restore default selection.
    if (!next && get(factorsSelectedIdAtom) == null) {
      set(factorsSelectedIdAtom, get(factorsDefaultSelectedIdAtom));
    }
    set(factorsSaveErrorAtom, null);
    set(factorsEditingStateAtom, next);
    set(factorsEditNameAtom, undefined);
    set(factorsEditGroupAtom, undefined);
    set(factorsEditDescriptionAtom, undefined);
    set(factorsEditWindowAtom, undefined);
    set(factorsEditDependenciesAtom, undefined);
    set(factorsSourceDraftAtom, undefined);
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
    source = applyFactorNameToSource(source, defaults.name);
  }
  return {
    ...defaults,
    ...parseUserFactorMetadataFromSource(source),
    source,
  };
}

export const factorsVisibleDetailAtom = atom((get) => {
  const detail = get(factorsDetailAtom);
  const createMode = get(creatingAtom);
  if (!detail && !createMode) return null;

  const baseForm = detail ?? resolveCreateForm(get(factorTemplateAtom));
  const editActive = get(factorsEditingAtom);
  if (!editActive) return baseForm;

  const drafts = {
    name: get(factorsEditNameAtom),
    group: get(factorsEditGroupAtom),
    description: get(factorsEditDescriptionAtom),
    window: get(factorsEditWindowAtom),
    dependencies: get(factorsEditDependenciesAtom),
    source: get(factorsSourceDraftAtom),
  };

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
    const saved =
      selectedId == null ? await createFactor(bodyFromForm(form)) : await patchFactor(selectedId, bodyFromForm(form));
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
