'use client';

import { useAtomValue } from 'jotai';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Item, ItemContent } from '@/components/ui/item';
import { factorsEditingAtom, factorsSaveErrorAtom, factorsSelectedIdAtom } from '@/models/factor';
import { FactorSourceField } from '../../ui/factor-form-fields';

export function PanelSourceTab() {
  const formError = useAtomValue(factorsSaveErrorAtom);
  const editing = useAtomValue(factorsEditingAtom);
  const selectedId = useAtomValue(factorsSelectedIdAtom);

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
          <FactorSourceField readOnly={!editing} pid={pid} />
        </div>
      </ItemContent>
    </Item>
  );
}
