'use client';

import { useAtomValue } from 'jotai';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Item, ItemContent } from '@/components/ui/item';
import { factorsEditingAtom, factorsSaveErrorAtom, factorsSelectedIdAtom } from '@/models/factor';
import { FactorMetaFields } from '../../ui/factor-form-fields';

export function PanelOverviewTab() {
  const formError = useAtomValue(factorsSaveErrorAtom);
  const editing = useAtomValue(factorsEditingAtom);
  const selectedId = useAtomValue(factorsSelectedIdAtom);

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
            <FactorMetaFields readOnly={!editing} pid={pid} hideNameField hideDescriptionField={false} />
          </div>
        </ItemContent>
      </Item>
    </div>
  );
}
