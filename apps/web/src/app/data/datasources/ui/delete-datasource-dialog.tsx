'use client';

import { useAtomValue, useSetAtom } from 'jotai';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  confirmDeleteDatasourceAtom,
  datasourcesDeleteTargetAtom,
  datasourcesDeletingAtom,
  dismissDeleteDatasourceDialogAtom,
} from '@/models/datasource/panel.atom';

export function DeleteDatasourceDialog() {
  const target = useAtomValue(datasourcesDeleteTargetAtom);
  const deleting = useAtomValue(datasourcesDeletingAtom);
  const confirmDelete = useSetAtom(confirmDeleteDatasourceAtom);
  const dismiss = useSetAtom(dismissDeleteDatasourceDialogAtom);
  return (
    <ConfirmDialog
      open={target !== null}
      onOpenChange={(o) => {
        if (!o) void dismiss();
      }}
      title="删除数据源"
      description={<>确定删除「{target?.name}」？此操作不可撤销。</>}
      confirmLabel="删除"
      confirmVariant="destructive"
      loading={deleting}
      loadingLabel="删除中…"
      onConfirm={confirmDelete}
    />
  );
}
