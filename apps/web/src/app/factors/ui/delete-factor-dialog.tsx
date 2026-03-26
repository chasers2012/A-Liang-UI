"use client";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { FactorSummaryPublic } from "@/lib/quant-agent-api";

type Props = {
    target: FactorSummaryPublic | null;
    deleting: boolean;
    onDismiss: () => void;
    onConfirm: () => void;
};

export function DeleteFactorDialog({
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
            title="删除因子"
            description={
                <>
                    确定删除因子「{target?.name}」？将同时删除 workspace
                    中的源码文件，此操作不可撤销。
                </>
            }
            confirmLabel="删除"
            confirmVariant="destructive"
            loading={deleting}
            loadingLabel="删除中…"
            onConfirm={onConfirm}
        />
    );
}
