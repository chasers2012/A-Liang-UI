'use client';

import { useAtomValue, useSetAtom } from 'jotai';

import { Textarea } from '@/components/ui/textarea';
import { mergedDescriptionAtom, setMetaDescriptionAtom } from '@/models/evaluation-profile/meta.atom';
import { isEditingAtom, loadingAtom } from '@/models/evaluation-profile/scope.atom';
import { Section } from '@/components/section';

export function EvaluationProfileMetaTabContent() {
  const isEditing = useAtomValue(isEditingAtom);
  const description = useAtomValue(mergedDescriptionAtom);
  const setDescription = useSetAtom(setMetaDescriptionAtom);
  const panelLoading = useAtomValue(loadingAtom);

  if (panelLoading) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1">
      <Section title="简介">
        <Textarea
          value={description}
          onChange={(e) => void setDescription(e.target.value)}
          readOnly={!isEditing}
          aria-label="评价方案描述"
          placeholder="无描述"
          className="min-h-28 resize-y text-sm leading-relaxed"
        />
      </Section>
    </div>
  );
}
