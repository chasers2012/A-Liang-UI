"use client";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { EvaluationTestSetPublic } from "@/lib/quant-agent-api";

type Props = {
  target: EvaluationTestSetPublic | null;
  deleting: boolean;
  onDismiss: () => void;
  onConfirm: () => void;
};

export function DeleteTestSetDialog({
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
      title="删除测试集"
      description={<>确定删除「{target?.name}」？此操作不可撤销。</>}
      confirmLabel="删除"
      confirmVariant="destructive"
      loading={deleting}
      loadingLabel="删除中…"
      onConfirm={onConfirm}
    />
  );
}
