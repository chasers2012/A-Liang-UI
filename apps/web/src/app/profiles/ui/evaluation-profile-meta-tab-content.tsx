'use client';

import { useAtomValue, useSetAtom } from 'jotai';

import { EditablePageDescription } from '@/components/editable-page-description';
import { evaluationProfileDetailAtomFamily } from '@/models/evaluation-profile/list-detail.atom';
import {
  evaluationProfilesPanelIsEditingAtom,
  evaluationProfilesPanelLoadingAtom,
  evaluationProfilesPanelSelectedIdAtom,
} from '@/models/evaluation-profile/panel.atom';
import {
  evaluationProfileFormStateAtomFamily,
  setEvaluationProfileFormDescriptionAtomFamily,
} from '@/models/evaluation-profile/form.atom';

export function EvaluationProfileMetaTabContent() {
  const isEditing = useAtomValue(evaluationProfilesPanelIsEditingAtom);
  const selectedId = useAtomValue(evaluationProfilesPanelSelectedIdAtom);
  const formState = useAtomValue(evaluationProfileFormStateAtomFamily(selectedId));
  const setDescription = useSetAtom(setEvaluationProfileFormDescriptionAtomFamily(selectedId));
  const { row } = useAtomValue(evaluationProfileDetailAtomFamily(selectedId ?? ''));
  const panelLoading = useAtomValue(evaluationProfilesPanelLoadingAtom);

  if (panelLoading) return null;

  const value = isEditing ? formState.description : (row?.description ?? '');

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1">
      {row || isEditing ? (
        <div className="rounded-md border bg-card p-4">
          <EditablePageDescription
            value={value}
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
