'use client';

import { Item, ItemContent } from '@/components/ui/item';
import { SectionHeader } from '@/components/section-header';
import type { FactorFormState } from '@/models/factor';
import { FactorFormFields } from '../../ui/factor-form-fields';
import { FactorEvaluationTrigger } from '../../ui/factor-evaluation-trigger';
import { FactorEvaluationResult } from '../../ui/factor-evaluation-result';

type PanelOverviewTabProps = {
  form: FactorFormState;
  setForm: (next: FactorFormState | ((prev: FactorFormState) => FactorFormState)) => void;
  formError: string | null;
  editing: boolean;
  selectedId: string | null;
};

export function PanelOverviewTab({ form, setForm, formError, editing, selectedId }: PanelOverviewTabProps) {
  return (
    <div className="flex flex-col gap-2.5">
      <Item variant="outline">
        <ItemContent>
          <FactorFormFields
            form={form}
            setForm={setForm}
            formError={formError}
            readOnly={!editing}
            idPrefix={`factor-overview-${selectedId ?? 'new'}`}
            variant="meta"
            hideNameField
          />
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
          <SectionHeader>评价结果</SectionHeader>
          <Item variant="outline">
            <ItemContent>
              <FactorEvaluationResult factorId={selectedId} />
            </ItemContent>
          </Item>
        </>
      ) : null}
    </div>
  );
}
