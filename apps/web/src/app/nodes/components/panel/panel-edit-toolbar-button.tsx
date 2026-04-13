"use client";

import { Button } from "@/components/ui/button";

export function NodeDetailEditToolbarButton(props: {
  canEdit: boolean;
  editing: boolean;
  saving?: boolean;
  saveDisabled?: boolean;
  cancelLabel?: string;
  saveLabel?: string;
  savingLabel?: string;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave?: () => void;
}) {
  const {
    canEdit,
    editing,
    saving = false,
    saveDisabled = false,
    cancelLabel = "取消",
    saveLabel = "保存",
    savingLabel = "保存中…",
    onStartEdit,
    onCancelEdit,
    onSave,
  } = props;
  if (!canEdit) return null;
  if (editing) {
    return (
      <div className="flex shrink-0 items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancelEdit}>
          {cancelLabel}
        </Button>
        <Button
          type="button"
          variant="default"
          size="sm"
          disabled={saving || saveDisabled}
          onClick={onSave}
        >
          {saving ? savingLabel : saveLabel}
        </Button>
      </div>
    );
  }
  return (
    <Button type="button" variant="default" size="sm" className="shrink-0" onClick={onStartEdit}>
      编辑
    </Button>
  );
}

