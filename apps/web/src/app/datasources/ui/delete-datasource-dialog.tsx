"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DataSourcePublic } from "@/lib/quant-agent-api";

type Props = {
  target: DataSourcePublic | null;
  deleting: boolean;
  onDismiss: () => void;
  onConfirm: () => void;
};

export function DeleteDatasourceDialog({
  target,
  deleting,
  onDismiss,
  onConfirm,
}: Props) {
  return (
    <Dialog open={target !== null} onOpenChange={(o) => !o && onDismiss()}>
      <DialogContent
        showCloseButton
        className="min-w-0 max-w-[calc(100%-2rem)] overflow-x-hidden border-border/80 sm:max-w-md"
      >
        <DialogHeader className="min-w-0 pr-8">
          <DialogTitle className="break-words">删除数据源</DialogTitle>
          <DialogDescription className="break-words">
            确定删除「{target?.name}」？此操作不可撤销。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mx-0 mb-0 mt-2 flex flex-row flex-wrap justify-end gap-2 border-t border-border/60 bg-transparent p-0 pt-4">
          <Button type="button" variant="outline" onClick={onDismiss}>
            取消
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={deleting}
            onClick={() => void onConfirm()}
          >
            {deleting ? "删除中…" : "删除"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
