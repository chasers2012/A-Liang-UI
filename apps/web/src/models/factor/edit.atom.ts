import { atom } from 'jotai';

import { createFactor, deleteFactor, patchFactor } from '@/api/factors';
import type { FactorDetailPublic } from './dto';
import { factorsDefaultSelectedIdAtom } from './browse.atom';
import { factorsDetailAtom, refreshFactorsDetailAtomFamily } from './detail.atom';
import { applyFormMetadataToSource, parseUserFactorMetadataFromSource } from './factor-metadata-sync';
import { bodyFromForm, defaultNewFactorName, emptyForm, validateFormForSubmit } from './form-model';
import { refreshFactorsListAtom } from './list-detail.atom';
import { factorsSelectedIdAtom } from './selection.atom';
import { factorTemplateAtom } from './template.atom';

export const factorsEditingAtom = atom(false);
export const factorsSavingAtom = atom(false);
export const factorsSaveErrorAtom = atom<string | null>(null);

export const factorsEditNameAtom = atom<string | undefined>(undefined);
export const factorsEditGroupAtom = atom<string | undefined>(undefined);
export const factorsEditDescriptionAtom = atom<string | undefined>(undefined);
export const factorsEditWindowAtom = atom<number | undefined>(undefined);
export const factorsEditDependenciesAtom = atom<string[] | undefined>(undefined);
export const factorsSourceDraftAtom = atom<string | undefined>(undefined);

const clearFactorDraftsAtom = atom(null, (_get, set) => {
  set(factorsEditNameAtom, undefined);
  set(factorsEditGroupAtom, undefined);
  set(factorsEditDescriptionAtom, undefined);
  set(factorsEditWindowAtom, undefined);
  set(factorsEditDependenciesAtom, undefined);
  set(factorsSourceDraftAtom, undefined);
});

export const factorsCanEditAtom = atom((get) => get(factorsDetailAtom) != null || get(factorsEditingAtom));
export const factorsCanDeleteAtom = atom((get) => get(factorsSelectedIdAtom) != null && get(factorsDetailAtom) != null);
export const factorsEditActiveAtom = atom((get) => get(factorsCanEditAtom) && get(factorsEditingAtom));
export const factorsCreateModeAtom = atom((get) => get(factorsEditActiveAtom) && get(factorsSelectedIdAtom) == null);
export const factorsReadonlyAtom = atom((get) => !get(factorsEditActiveAtom));

function resolveCreateForm(templateSource: string | null): FactorDetailPublic {
  const defaults = {
    ...emptyForm(),
    name: defaultNewFactorName(),
  };
  const source = templateSource ? applyFormMetadataToSource(templateSource, defaults) : '';
  return {
    ...defaults,
    ...parseUserFactorMetadataFromSource(source),
    source,
  };
}

function applyPatch(form: FactorDetailPublic, patch: Partial<FactorDetailPublic>): FactorDetailPublic {
  if (Object.prototype.hasOwnProperty.call(patch, 'source')) {
    const source = patch.source ?? '';
    const parsed = parseUserFactorMetadataFromSource(source);
    return { ...form, ...patch, ...parsed, source };
  }
  const next = { ...form, ...patch };
  const metadataChanged =
    Object.prototype.hasOwnProperty.call(patch, 'name') ||
    Object.prototype.hasOwnProperty.call(patch, 'group') ||
    Object.prototype.hasOwnProperty.call(patch, 'description') ||
    Object.prototype.hasOwnProperty.call(patch, 'window') ||
    Object.prototype.hasOwnProperty.call(patch, 'dependencies');
  if (!metadataChanged) return next;
  return { ...next, source: applyFormMetadataToSource(next.source, next) };
}

export const factorsVisibleDetailAtom = atom((get) => {
  const detail = get(factorsDetailAtom);
  const createMode = get(factorsCreateModeAtom);
  if (!detail && !createMode) return null;

  const baseForm = detail ?? resolveCreateForm(get(factorTemplateAtom));
  const editActive = get(factorsEditActiveAtom);
  const patch: Partial<FactorDetailPublic> = {};
  const draftName = get(factorsEditNameAtom);
  const draftGroup = get(factorsEditGroupAtom);
  const draftDescription = get(factorsEditDescriptionAtom);
  const draftWindow = get(factorsEditWindowAtom);
  const draftDependencies = get(factorsEditDependenciesAtom);
  const draftSource = get(factorsSourceDraftAtom);
  if (editActive) {
    if (draftName !== undefined) patch.name = draftName;
    if (draftGroup !== undefined) patch.group = draftGroup;
    if (draftDescription !== undefined) patch.description = draftDescription;
    if (draftWindow !== undefined) patch.window = draftWindow;
    if (draftDependencies !== undefined) patch.dependencies = draftDependencies;
    if (draftSource !== undefined) patch.source = draftSource;
  }
  return applyPatch(baseForm, patch);
});

export const setFactorsFormAtom = atom(
  null,
  (get, set, next: FactorDetailPublic | ((prev: FactorDetailPublic) => FactorDetailPublic)) => {
    const current = get(factorsVisibleDetailAtom) ?? resolveCreateForm(get(factorTemplateAtom));
    const target = typeof next === 'function' ? next(current) : next;
    set(factorsEditNameAtom, target.name);
    set(factorsEditGroupAtom, target.group);
    set(factorsEditDescriptionAtom, target.description);
    set(factorsEditWindowAtom, target.window);
    set(factorsEditDependenciesAtom, target.dependencies);
    set(factorsSourceDraftAtom, target.source);
  },
);

export const startCreateFactorAtom = atom(null, (_get, set) => {
  set(factorsSelectedIdAtom, null);
  set(clearFactorDraftsAtom);
  set(factorsSaveErrorAtom, null);
  set(factorsEditingAtom, true);
});

export const startEditFactorAtom = atom(null, (_get, set) => {
  set(factorsSaveErrorAtom, null);
  set(factorsEditingAtom, true);
});

export const handleCancelFactorEditAtom = atom<null, [], void>(null, (get, set) => {
  set(factorsSaveErrorAtom, null);
  set(clearFactorDraftsAtom);
  set(factorsEditingAtom, false);

  // Creating mode uses `selectedId == null`; cancel should restore default selection.
  if (get(factorsSelectedIdAtom) == null) {
    set(factorsSelectedIdAtom, get(factorsDefaultSelectedIdAtom));
  }
});

export const handleSaveFactorDetailAtom = atom(null, async (get, set) => {
  if (get(factorsSavingAtom)) return null;
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
    set(clearFactorDraftsAtom);
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
  const selectedId = get(factorsSelectedIdAtom);
  if (!selectedId) return false;
  await deleteFactor(selectedId);
  await set(refreshFactorsListAtom);
  set(factorsSelectedIdAtom, null);
  set(factorsEditingAtom, false);
  set(clearFactorDraftsAtom);
  return true;
});
