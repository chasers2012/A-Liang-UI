'use client';

import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { Pencil } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  cancelEditorAtom,
  enterEditorAtom,
  isEditingAtom,
  selectedIdAtom,
} from '@/models/evaluation-profile/scope.atom';
import { commitEditorAtom, formStateAtom } from '@/models/evaluation-profile/form.atom';

export function EvaluationProfilePanelActions() {
  const isEditing = useAtomValue(isEditingAtom);
  const [selectedId] = useAtom(selectedIdAtom);
  const isCreate = selectedId == null;
  const formState = useAtomValue(formStateAtom);
  const cancelEditor = useSetAtom(cancelEditorAtom);
  const enterEditor = useSetAtom(enterEditorAtom);
  const commitEditor = useSetAtom(commitEditorAtom);

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void cancelEditor()}
          disabled={formState.submitting}
        >
          取消
        </Button>
        <Button
          type="button"
          variant="default"
          size="sm"
          disabled={formState.submitting || !formState.name.trim()}
          onClick={() => void commitEditor()}
        >
          {formState.submitting ? (isCreate ? '创建中…' : '保存中…') : isCreate ? '创建' : '保存'}
        </Button>
      </div>
    );
  }

  if (!selectedId) return null;

  return (
    <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => void enterEditor()}>
      <Pencil className="size-4" aria-hidden />
      编辑
    </Button>
  );
}
