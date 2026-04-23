'use client';

import { useMemo, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';

import { Button } from '@/components/ui/button';
import {
  creatingAtom,
  factorsEditingAtom,
  factorsListAtom,
  factorsSavingAtom,
  factorsSelectedIdAtom,
  handleDeleteFactorAtom,
  handleSaveFactorDetailAtom,
} from '@/models/factor';
import { DeleteFactorDialog } from '../../ui/delete-factor-dialog';

export function FactorDetailToolbarButton() {
  const saveForm = useSetAtom(handleSaveFactorDetailAtom);
  const setEditing = useSetAtom(factorsEditingAtom);
  const deleteSelected = useSetAtom(handleDeleteFactorAtom);
  const listItems = useAtomValue(factorsListAtom);
  const selectedId = useAtomValue(factorsSelectedIdAtom);
  const editing = useAtomValue(factorsEditingAtom);
  const isCreating = useAtomValue(creatingAtom);
  const sourceSaving = useAtomValue(factorsSavingAtom);

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const deleteTarget = useMemo(() => {
    if (!deleteTargetId) return null;
    return listItems?.find((item) => item.id === deleteTargetId) ?? null;
  }, [deleteTargetId, listItems]);

  const onDelete = () => {
    if (!selectedId) return;
    setDeleteTargetId(selectedId);
  };

  if (isCreating) {
    return (
      <>
        <Button variant="outline" disabled={sourceSaving} onClick={() => setEditing(false)}>
          取消创建
        </Button>
        <Button disabled={sourceSaving} onClick={() => void saveForm()}>
          {sourceSaving ? '创建中…' : '创建因子'}
        </Button>
      </>
    );
  }

  if (editing) {
    return (
      <>
        <Button variant="outline" disabled={sourceSaving} onClick={() => setEditing(false)}>
          取消
        </Button>
        <Button disabled={sourceSaving || !selectedId} onClick={() => void saveForm()}>
          {sourceSaving ? '保存中…' : '保存'}
        </Button>
      </>
    );
  }

  return (
    <>
      <Button variant="destructive" disabled={!selectedId} onClick={onDelete}>
        删除
      </Button>
      <Button
        disabled={!selectedId}
        onClick={() => {
          setEditing(true);
        }}
      >
        编辑
      </Button>
      <DeleteFactorDialog
        target={deleteTarget}
        deleting={deleting}
        onDismiss={() => {
          if (deleting) return;
          setDeleteTargetId(null);
        }}
        onConfirm={() => {
          if (deleting) return;
          setDeleting(true);
          void deleteSelected()
            .then(() => {
              setDeleteTargetId(null);
            })
            .catch((e) => {
              window.alert(e instanceof Error ? e.message : String(e));
            })
            .finally(() => {
              setDeleting(false);
            });
        }}
      />
    </>
  );
}
