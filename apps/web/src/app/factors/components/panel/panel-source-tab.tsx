'use client';

import { useAtomValue, useSetAtom } from 'jotai';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Item, ItemContent } from '@/components/ui/item';
import {
  factorsEditingAtom,
  factorsSaveErrorAtom,
  factorsSelectedIdAtom,
  factorsVisibleDetailAtom,
  setFactorsFormAtom,
} from '@/models/factor';
import { applyFactorFormPatch, FactorSourceField } from '../../ui/factor-form-fields';

export function PanelSourceTab() {
  const form = useAtomValue(factorsVisibleDetailAtom);
  const setForm = useSetAtom(setFactorsFormAtom);
  const formError = useAtomValue(factorsSaveErrorAtom);
  const editing = useAtomValue(factorsEditingAtom);
  const selectedId = useAtomValue(factorsSelectedIdAtom);

  if (!form) return null;

  const set = (patch: Partial<typeof form>) => {
    setForm((prev) => applyFactorFormPatch(prev, patch));
  };
  const pid = (s: string) => `factor-source-${selectedId ?? 'new'}-${s}`;

  return (
    <Item variant="outline">
      <ItemContent>
        <div className="space-y-4">
          {formError ? (
            <Alert variant="destructive">
              <AlertTitle>无法保存</AlertTitle>
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          ) : null}
          <FactorSourceField form={form} set={set} readOnly={!editing} pid={pid} />
        </div>
      </ItemContent>
    </Item>
  );
}
