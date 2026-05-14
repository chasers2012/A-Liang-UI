'use client';

import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { Pencil } from 'lucide-react';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  cancelEvaluationProfileEditorAtom,
  enterEvaluationProfileEditorAtom,
  evaluationProfilesPanelIsEditingAtom,
  evaluationProfilesPanelSelectedIdAtom,
} from '@/models/evaluation-profile/panel.atom';
import {
  commitEvaluationProfileEditorAtom,
  evaluationProfileFormStateAtomFamily,
} from '@/models/evaluation-profile/form.atom';

export function EvaluationProfilePanelActions() {
  const isEditing = useAtomValue(evaluationProfilesPanelIsEditingAtom);
  const [selectedId] = useAtom(evaluationProfilesPanelSelectedIdAtom);
  const isCreate = selectedId == null;
  const formKey = isCreate ? '__new__' : selectedId;
  const formState = useAtomValue(evaluationProfileFormStateAtomFamily(formKey));
  const cancelEditor = useSetAtom(cancelEvaluationProfileEditorAtom);
  const enterEditor = useSetAtom(enterEvaluationProfileEditorAtom);
  const commitEditor = useSetAtom(commitEvaluationProfileEditorAtom);

  const pending = formState.loading || formState.templateLoading || formState.loadError;

  if (isEditing && pending) {
    return (
      <button
        type="button"
        className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
        onClick={() => void cancelEditor()}
      >
        取消
      </button>
    );
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
          onClick={() => void cancelEditor()}
          disabled={formState.submitting}
        >
          取消
        </button>
        <button
          type="button"
          className={cn(buttonVariants({ variant: 'default', size: 'sm' }))}
          disabled={formState.submitting || !formState.name.trim()}
          onClick={() => void commitEditor()}
        >
          {formState.submitting ? (isCreate ? '创建中…' : '保存中…') : isCreate ? '创建' : '保存'}
        </button>
      </div>
    );
  }

  if (!selectedId) return null;

  return (
    <button
      type="button"
      className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1.5')}
      onClick={() => void enterEditor()}
    >
      <Pencil className="size-4" aria-hidden />
      编辑
    </button>
  );
}
