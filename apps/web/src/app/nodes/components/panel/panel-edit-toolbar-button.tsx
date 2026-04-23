'use client';

import { useState } from 'react';
import { useAtom } from 'jotai';
import { useAtomValue, useSetAtom } from 'jotai';

import { Button } from '@/components/ui/button';
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
import {
  handleCancelNodesEditAtom,
  handleDeleteNodeAtom,
  handleSaveNodesDetailAtom,
  nodesCanDeleteAtom,
  nodesCanEditAtom,
  nodesDeletingAtom,
  nodesEditActiveAtom,
  nodesEditNameAtom,
  nodesEditingAtom,
  nodesIsPluginNodeAtom,
  nodesSaveErrorAtom,
  nodesSavingAtom,
  nodesVisibleDetailAtom,
} from '@/models/nodes/edit.atom';

export function NodeDetailEditToolbarButton() {
  const canEdit = useAtomValue(nodesCanEditAtom);
  const canDelete = useAtomValue(nodesCanDeleteAtom);
  const isPluginNode = useAtomValue(nodesIsPluginNodeAtom);
  const deleting = useAtomValue(nodesDeletingAtom);
  const editActive = useAtomValue(nodesEditActiveAtom);
  const saving = useAtomValue(nodesSavingAtom);
  const visibleDetail = useAtomValue(nodesVisibleDetailAtom);
  const [editing, setEditing] = useAtom(nodesEditingAtom);
  const [editName] = useAtom(nodesEditNameAtom);
  const [, setSaveError] = useAtom(nodesSaveErrorAtom);
  const handleSave = useSetAtom(handleSaveNodesDetailAtom);
  const handleCancel = useSetAtom(handleCancelNodesEditAtom);
  const handleDelete = useSetAtom(handleDeleteNodeAtom);

  const visibleName = (editName ?? visibleDetail?.name ?? '').toString();
  const editDisabled = isPluginNode;
  const saveDisabled = editActive ? !visibleName.trim() : true;
  const saveLoading = editActive ? saving : false;
  const deleteDisabled = deleting || isPluginNode;

  const [cancelOpen, setCancelOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleConfirmCancel = () => {
    setCancelOpen(false);
    handleCancel();
  };
  const handleConfirmSave = () => {
    setSaveOpen(false);
    void handleSave();
  };
  const handleConfirmDelete = () => {
    setDeleteOpen(false);
    void handleDelete();
  };

  if (editing) {
    return (
      <div className="flex shrink-0 items-center gap-2">
        <Button type="button" variant="outline" onClick={() => setCancelOpen(true)}>
          取消
        </Button>
        <Button
          type="button"
          variant="default"
          disabled={saveLoading || saveDisabled}
          onClick={() => setSaveOpen(true)}
        >
          {saveLoading ? '保存中…' : '保存'}
        </Button>
        <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认取消编辑？</AlertDialogTitle>
              <AlertDialogDescription>当前未保存的修改将会丢失。</AlertDialogDescription>
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
              <AlertDialogDescription>保存后会覆盖当前节点的源码内容。</AlertDialogDescription>
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
  if (!canEdit) return null;

  if (!canDelete) {
    return (
      <Button
        type="button"
        variant="default"
        className="shrink-0"
        disabled={editDisabled}
        onClick={() => {
          if (!canEdit) return;
          setSaveError(null);
          setEditing(true);
        }}
      >
        编辑
      </Button>
    );
  }
  return (
    <div className="flex shrink-0 items-center gap-2">
      <Button
        type="button"
        variant="default"
        disabled={editDisabled}
        onClick={() => {
          if (!canEdit) return;
          setSaveError(null);
          setEditing(true);
        }}
      >
        编辑
      </Button>
      <Button type="button" variant="destructive" disabled={deleteDisabled} onClick={() => setDeleteOpen(true)}>
        删除
      </Button>
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除节点？</AlertDialogTitle>
            <AlertDialogDescription>删除后不可恢复，请谨慎操作。</AlertDialogDescription>
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
