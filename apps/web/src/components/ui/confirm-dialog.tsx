'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog';
import type { ComponentProps, ReactNode } from 'react';

export type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ComponentProps<typeof DialogHeader>['title'];
  description: ReactNode;
  cancelLabel?: string;
  confirmLabel: string;
  confirmVariant?: 'default' | 'destructive';
  loading?: boolean;
  /** 提交中按钮文案，例如「删除中…」 */
  loadingLabel?: string;
  showCloseButton?: boolean;
  onConfirm: () => void;
};

/** 统一样式的确认类弹窗（删除、危险操作等） */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  cancelLabel = '取消',
  confirmLabel,
  confirmVariant = 'default',
  loading = false,
  loadingLabel,
  showCloseButton = true,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader showCloseButton={showCloseButton} title={title} />
        <DialogBody variant="inset">{description}</DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button type="button" variant={confirmVariant} disabled={loading} onClick={() => void onConfirm()}>
            {loading ? (loadingLabel ?? `${confirmLabel}中…`) : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
