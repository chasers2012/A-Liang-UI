'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useNavigationEditGuardShell } from '@/components/navigation-edit-guard-context';

export function NavigationEditGuardDialog() {
  const router = useRouter();
  const shell = useNavigationEditGuardShell();
  const pendingHref = shell?.pendingHref ?? null;
  const setPendingHref = shell?.setPendingHref;

  const open = pendingHref != null;

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) setPendingHref?.(null);
    },
    [setPendingHref],
  );

  const handleConfirm = useCallback(() => {
    if (!shell || !pendingHref) return;
    const abandon = shell.getActiveAbandon();
    shell.setPendingHref(null);
    router.push(pendingHref);
    queueMicrotask(() => {
      abandon?.();
    });
  }, [shell, pendingHref, router]);

  if (!shell) return null;

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>放弃未保存的编辑？</AlertDialogTitle>
          <AlertDialogDescription>
            当前页面处于编辑状态，切换后将丢失未保存的修改。是否放弃编辑并离开？
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>继续编辑</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>放弃编辑</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
