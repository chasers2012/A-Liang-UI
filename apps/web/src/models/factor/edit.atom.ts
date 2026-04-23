import { atom } from 'jotai';

import { createFactor, deleteFactor, getFactor, patchFactor } from '@/api/factors';
import { applyFormMetadataToSource, parseUserFactorMetadataFromSource } from './factor-metadata-sync';
import {
  bodyFromForm,
  defaultNewFactorName,
  emptyForm,
  hydrateFromDetail,
  validateFormForSubmit,
  type FactorFormState,
} from './form-model';
import { refreshFactorsListAtom } from './list-detail.atom';
import { factorsSelectedIdAtom } from './selection.atom';
import { factorTemplateAtom } from './template.atom';

export const factorsEditingAtom = atom(false);
export const factorsEditorLoadingAtom = atom(false);
export const factorsEditorLoadErrorAtom = atom<string | null>(null);
export const factorsSavingAtom = atom(false);
export const factorsFormErrorAtom = atom<string | null>(null);
export const factorsFormAtom = atom<FactorFormState | null>(null);

export const factorsCreateModeAtom = atom((get) => get(factorsEditingAtom) && get(factorsSelectedIdAtom) == null);

export const factorsReadonlyAtom = atom((get) => !get(factorsEditingAtom));

export const startCreateFactorAtom = atom(null, (_get, set) => {
  set(factorsSelectedIdAtom, null);
  set(factorsEditingAtom, true);
  set(factorsFormErrorAtom, null);
  set(factorsEditorLoadErrorAtom, null);
});

export const startEditFactorAtom = atom(null, (_get, set) => {
  set(factorsEditingAtom, true);
  set(factorsFormErrorAtom, null);
  set(factorsEditorLoadErrorAtom, null);
});

export const cancelFactorEditAtom = atom(null, (_get, set) => {
  set(factorsEditingAtom, false);
  set(factorsFormErrorAtom, null);
});

export const setFactorsFormAtom = atom(
  null,
  (_get, set, next: FactorFormState | ((prev: FactorFormState) => FactorFormState)) => {
    set(factorsFormAtom, (prev) => {
      const base = prev ?? emptyForm();
      return typeof next === 'function' ? next(base) : next;
    });
  },
);

export const loadFactorEditorAtom = atom(null, async (get, set) => {
  const isCreateMode = get(factorsCreateModeAtom);
  const selectedId = get(factorsSelectedIdAtom);

  set(factorsEditorLoadingAtom, true);
  set(factorsEditorLoadErrorAtom, null);
  set(factorsFormErrorAtom, null);
  try {
    if (isCreateMode) {
      const source = get(factorTemplateAtom);
      if (!source) throw new Error('因子模板加载失败');
      const patched = applyFormMetadataToSource(source, {
        ...emptyForm(),
        name: defaultNewFactorName(),
      });
      const parsedMeta = parseUserFactorMetadataFromSource(patched);
      set(factorsFormAtom, {
        ...emptyForm(),
        ...parsedMeta,
        source: patched,
      });
      return;
    }

    if (!selectedId) {
      set(factorsFormAtom, null);
      return;
    }

    const detail = await getFactor(selectedId);
    set(factorsFormAtom, hydrateFromDetail(detail));
  } catch (e) {
    set(factorsFormAtom, null);
    set(factorsEditorLoadErrorAtom, e instanceof Error ? e.message : String(e));
  } finally {
    set(factorsEditorLoadingAtom, false);
  }
});

export const saveFactorFormAtom = atom(null, async (get, set) => {
  const saving = get(factorsSavingAtom);
  if (saving) return null;
  const form = get(factorsFormAtom);
  if (!form) return null;

  set(factorsFormErrorAtom, null);
  const validateError = validateFormForSubmit(form);
  if (validateError) {
    set(factorsFormErrorAtom, validateError);
    return null;
  }

  set(factorsSavingAtom, true);
  try {
    const selectedId = get(factorsSelectedIdAtom);
    const saved =
      selectedId == null ? await createFactor(bodyFromForm(form)) : await patchFactor(selectedId, bodyFromForm(form));
    set(factorsFormAtom, hydrateFromDetail(saved));
    await set(refreshFactorsListAtom);
    set(factorsEditingAtom, false);
    set(factorsSelectedIdAtom, saved.id);
    return saved.id;
  } catch (e) {
    set(factorsFormErrorAtom, e instanceof Error ? e.message : String(e));
    return null;
  } finally {
    set(factorsSavingAtom, false);
  }
});

export const deleteSelectedFactorAtom = atom(null, async (get, set) => {
  const selectedId = get(factorsSelectedIdAtom);
  if (!selectedId) return false;
  await deleteFactor(selectedId);
  await set(refreshFactorsListAtom);
  set(factorsSelectedIdAtom, null);
  set(factorsEditingAtom, false);
  set(factorsFormAtom, null);
  return true;
});
