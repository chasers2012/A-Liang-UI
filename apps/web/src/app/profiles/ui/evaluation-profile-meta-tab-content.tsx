'use client';

import { useAtomValue, useSetAtom } from 'jotai';

import { EditablePageDescription } from '@/components/editable-page-description';
import {
  evaluationProfileMetaPresentationAtom,
  setEvaluationProfileMetaDescriptionAtom,
} from '@/models/evaluation-profile/meta.atom';
import {
  evaluationProfilesPanelIsEditingAtom,
  evaluationProfilesPanelLoadingAtom,
} from '@/models/evaluation-profile/panel.atom';

export function EvaluationProfileMetaTabContent() {
  const isEditing = useAtomValue(evaluationProfilesPanelIsEditingAtom);
  const { description, showSection } = useAtomValue(evaluationProfileMetaPresentationAtom);
  const setDescription = useSetAtom(setEvaluationProfileMetaDescriptionAtom);
  const panelLoading = useAtomValue(evaluationProfilesPanelLoadingAtom);

  if (panelLoading) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1">
      {showSection ? (
        <div className="rounded-md border bg-card p-4">
          <EditablePageDescription
            value={description}
            onChange={(v) => void setDescription(v)}
            textareaAriaLabel="评价方案描述"
            emptyText="无描述"
            showEdit={isEditing}
          />
        </div>
      ) : null}
    </div>
  );
}
