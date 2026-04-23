'use client';

import { Item, ItemContent } from '@/components/ui/item';
import type { FactorFormState } from '@/models/factor';
import { FactorFormFields } from '../../ui/factor-form-fields';

type PanelSourceTabProps = {
  form: FactorFormState;
  setForm: (next: FactorFormState | ((prev: FactorFormState) => FactorFormState)) => void;
  formError: string | null;
  editing: boolean;
  selectedId: string | null;
};

export function PanelSourceTab({ form, setForm, formError, editing, selectedId }: PanelSourceTabProps) {
  return (
    <Item variant="outline">
      <ItemContent>
        <FactorFormFields
          form={form}
          setForm={setForm}
          formError={formError}
          readOnly={!editing}
          idPrefix={`factor-source-${selectedId ?? 'new'}`}
          variant="source"
        />
      </ItemContent>
    </Item>
  );
}
