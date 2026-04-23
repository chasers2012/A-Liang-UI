'use client';

import { Button } from '@/components/ui/button';

type FactorDetailToolbarButtonProps = {
  editing: boolean;
  isCreating: boolean;
  sourceSaving: boolean;
  selectedId: string | null;
  onCancelCreate: () => void;
  onCreate: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onDelete: () => void;
  onEdit: () => void;
};

export function FactorDetailToolbarButton({
  editing,
  isCreating,
  sourceSaving,
  selectedId,
  onCancelCreate,
  onCreate,
  onCancelEdit,
  onSave,
  onDelete,
  onEdit,
}: FactorDetailToolbarButtonProps) {
  if (isCreating) {
    return (
      <>
        <Button variant="outline" disabled={sourceSaving} onClick={onCancelCreate}>
          取消创建
        </Button>
        <Button disabled={sourceSaving} onClick={onCreate}>
          {sourceSaving ? '创建中…' : '创建因子'}
        </Button>
      </>
    );
  }

  if (editing) {
    return (
      <>
        <Button variant="outline" disabled={sourceSaving} onClick={onCancelEdit}>
          取消
        </Button>
        <Button disabled={sourceSaving || !selectedId} onClick={onSave}>
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
      <Button disabled={!selectedId} onClick={onEdit}>
        编辑
      </Button>
    </>
  );
}
