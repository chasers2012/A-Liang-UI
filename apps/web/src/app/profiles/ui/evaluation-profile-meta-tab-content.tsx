'use client';

import { useAtomValue, useSetAtom } from 'jotai';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { EditablePageDescription } from '@/components/editable-page-description';
import { evaluationProfileDetailGate } from './evaluation-profile-detail-gate';
import { evaluationProfileDetailAtomFamily } from '@/models/evaluation-profile/list-detail.atom';
import { evaluationProfilesPanelSelectedIdAtom } from '@/models/evaluation-profile/panel.atom';
import type { EvaluationProfileFormState } from '@/models/evaluation-profile/form.atom';
import {
  evaluationProfileFormStateAtomFamily,
  setEvaluationProfileFormDescriptionAtomFamily,
} from '@/models/evaluation-profile/form.atom';
import type { EvaluationProfilePublic } from '@/models/evaluation-profile/dto';

function MetaTabPending(props: { formState: EvaluationProfileFormState }) {
  const { formState } = props;
  if (formState.loadError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{formState.loadError}</AlertDescription>
      </Alert>
    );
  }
  return <p className="text-sm text-muted-foreground">{formState.templateLoading ? '加载工作流模板…' : '加载中…'}</p>;
}

function MetaTabReadonlyBlock(props: { row: EvaluationProfilePublic }) {
  const { row } = props;
  return (
    <div className="rounded-md border bg-card p-4 text-sm leading-6 text-foreground whitespace-pre-wrap">
      {row.description?.trim() || '无描述'}
    </div>
  );
}

function MetaTabEditingFields(props: {
  formState: EvaluationProfileFormState;
  onDescriptionChange: (v: string) => void;
}) {
  const { formState, onDescriptionChange } = props;
  return (
    <>
      {formState.formError ? (
        <Alert variant="destructive" className="shrink-0">
          <AlertTitle>无法保存</AlertTitle>
          <AlertDescription>{formState.formError}</AlertDescription>
        </Alert>
      ) : null}
      <div className="space-y-2">
        <EditablePageDescription
          value={formState.description}
          onChange={(v) => void onDescriptionChange(v)}
          textareaAriaLabel="评价方案描述"
        />
      </div>
    </>
  );
}

export function EvaluationProfileMetaTabContent(props: { isEditing: boolean }) {
  const { isEditing } = props;
  const selectedId = useAtomValue(evaluationProfilesPanelSelectedIdAtom);
  const isCreate = selectedId == null;
  const formKey = isCreate ? '__new__' : selectedId;
  const formState = useAtomValue(evaluationProfileFormStateAtomFamily(formKey));
  const setDescription = useSetAtom(setEvaluationProfileFormDescriptionAtomFamily(formKey));
  const { row, error } = useAtomValue(evaluationProfileDetailAtomFamily(selectedId ?? ''));

  const pending = isEditing && (formState.loading || formState.templateLoading || formState.loadError);

  if (pending) {
    return (
      <div className="flex flex-col gap-4 px-1">
        <MetaTabPending formState={formState} />
      </div>
    );
  }

  const gate = !isEditing ? evaluationProfileDetailGate(selectedId, error, row) : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1">
      {!isEditing && (gate ?? (row ? <MetaTabReadonlyBlock row={row} /> : null))}
      {isEditing ? <MetaTabEditingFields formState={formState} onDescriptionChange={setDescription} /> : null}
    </div>
  );
}
