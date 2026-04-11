"use client";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { PreprocessorSummaryPublic } from "@/api";

type Props = {
  target: PreprocessorSummaryPublic | null;
  deleting: boolean;
  onDismiss: () => void;
  onConfirm: () => void;
};

export function DeletePreprocessorDialog({
  target,
  deleting,
  onDismiss,
  onConfirm,
}: Props) {
  return (
    <ConfirmDialog
      open={target !== null}
      onOpenChange={(o) => {
        if (!o) onDismiss();
      }}
      title="删除预处理器"
      description={<>确定删除「{target?.name}」？此操作不可撤销。</>}
      confirmLabel="删除"
      confirmVariant="destructive"
      loading={deleting}
      loadingLabel="删除中…"
      onConfirm={onConfirm}
    />
  );
}

