"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function NodeDetailEditToolbarButton(props: {
  canEdit: boolean;
  editDisabled?: boolean;
  editing: boolean;
  saving?: boolean;
  saveDisabled?: boolean;
  deleteDisabled?: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave?: () => void;
  onDelete?: () => void;
}) {
  const {
    canEdit,
    editDisabled = false,
    editing,
    saving = false,
    saveDisabled = false,
    deleteDisabled = false,
    onStartEdit,
    onCancelEdit,
    onSave,
    onDelete,
  } = props;
  const [cancelOpen, setCancelOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleConfirmCancel = () => {
    setCancelOpen(false);
    onCancelEdit();
  };
  const handleConfirmSave = () => {
    setSaveOpen(false);
    onSave?.();
  };
  const handleConfirmDelete = () => {
    setDeleteOpen(false);
    onDelete?.();
  };

  if (!canEdit) return null;
  if (editing) {
    return (
      <div className="flex shrink-0 items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setCancelOpen(true)}>
          取消
        </Button>
        <Button
          type="button"
          variant="default"
          size="sm"
          disabled={saving || saveDisabled}
          onClick={() => setSaveOpen(true)}
        >
          {saving ? "保存中…" : "保存"}
        </Button>
        <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认取消编辑？</AlertDialogTitle>
              <AlertDialogDescription>
                当前未保存的修改将会丢失。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>继续编辑</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={handleConfirmCancel}>
                确认取消
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog open={saveOpen} onOpenChange={setSaveOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认保存修改？</AlertDialogTitle>
              <AlertDialogDescription>
                保存后会覆盖当前节点的源码内容。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>返回检查</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmSave}>确认保存</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }
  if (!onDelete) {
    return (
      <Button
        type="button"
        variant="default"
        size="sm"
        className="shrink-0"
        disabled={editDisabled}
        onClick={onStartEdit}
      >
        编辑
      </Button>
    );
  }
  return (
    <div className="flex shrink-0 items-center gap-2">
      <Button type="button" variant="default" size="sm" disabled={editDisabled} onClick={onStartEdit}>
        编辑
      </Button>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        disabled={deleteDisabled}
        onClick={() => setDeleteOpen(true)}
      >
        删除
      </Button>
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除节点？</AlertDialogTitle>
            <AlertDialogDescription>
              删除后不可恢复，请谨慎操作。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleConfirmDelete}>
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

