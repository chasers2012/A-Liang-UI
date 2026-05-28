'use client';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { DataSetPublic } from '@/models/data-set/dto';

type Props = {
  target: DataSetPublic | null;
  deleting: boolean;
  onDismiss: () => void;
  onConfirm: () => void;
};

export function DeleteDataSetDialog({ target, deleting, onDismiss, onConfirm }: Props) {
  return (
    <ConfirmDialog
      open={target !== null}
      onOpenChange={(o) => {
        if (!o) onDismiss();
      }}
      title="删除数据集"
      description={<>确定删除「{target?.name}」？此操作不可撤销。</>}
      confirmLabel="删除"
      confirmVariant="destructive"
      loading={deleting}
      loadingLabel="删除中…"
      onConfirm={onConfirm}
    />
  );
}
