'use client';

import { useAtomValue, useSetAtom } from 'jotai';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Item, ItemContent } from '@/components/ui/item';
import { SectionHeader } from '@/components/section-header';
import {
  factorsEditingAtom,
  factorsSaveErrorAtom,
  factorsSelectedIdAtom,
  factorsVisibleDetailAtom,
  setFactorsFormAtom,
} from '@/models/factor';
import { applyFactorFormPatch, FactorMetaFields } from '../../ui/factor-form-fields';
import { FactorEvaluationTrigger } from '../../ui/factor-evaluation-trigger';

export function PanelOverviewTab() {
  const form = useAtomValue(factorsVisibleDetailAtom);
  const setForm = useSetAtom(setFactorsFormAtom);
  const formError = useAtomValue(factorsSaveErrorAtom);
  const editing = useAtomValue(factorsEditingAtom);
  const selectedId = useAtomValue(factorsSelectedIdAtom);

  if (!form) return null;

  const set = (patch: Partial<typeof form>) => {
    setForm((prev) => applyFactorFormPatch(prev, patch));
  };
  const pid = (s: string) => `factor-overview-${selectedId ?? 'new'}-${s}`;

  return (
    <div className="flex flex-col gap-2.5">
      <Item variant="outline">
        <ItemContent>
          <div className="space-y-4">
            {formError ? (
              <Alert variant="destructive">
                <AlertTitle>无法保存</AlertTitle>
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            ) : null}
            <FactorMetaFields
              form={form}
              set={set}
              readOnly={!editing}
              pid={pid}
              hideNameField
              hideDescriptionField={false}
            />
          </div>
        </ItemContent>
      </Item>
      {selectedId ? (
        <>
          <SectionHeader>因子评价</SectionHeader>
          <Item variant="outline">
            <ItemContent>
              <FactorEvaluationTrigger factorId={selectedId} />
            </ItemContent>
          </Item>
        </>
      ) : null}
    </div>
  );
}
