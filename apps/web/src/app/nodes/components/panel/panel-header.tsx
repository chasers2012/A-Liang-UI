"use client";

import { FactorEditPageTitle } from "@/app/factors/ui/factor-edit-page-title";
import { CardHeader, CardTitle } from "@/components/ui/card";
import type { NodeDetailPublic } from "@/models/nodes/dto";

export function NodeDetailCardHeader(props: {
  editActive: boolean;
  canEdit: boolean;
  editName: string;
  onEditNameChange: (name: string) => void;
  detail: NodeDetailPublic | null;
  effectiveNodeId: string | null;
}) {
  const { editActive, canEdit, editName, onEditNameChange, detail, effectiveNodeId } = props;
  const headerTitle = detail?.name ?? (effectiveNodeId ? "加载中…" : "节点");
  if (editActive && canEdit) {
    return (
      <CardHeader className="shrink-0 space-y-2">
        <div className="space-y-2">
          <FactorEditPageTitle
            name={editName}
            onNameChange={onEditNameChange}
            nameAriaLabel="节点名称"
          />
        </div>
      </CardHeader>
    );
  }
  return (
    <CardHeader className="shrink-0">
      <CardTitle className="min-w-0 truncate" title={detail?.name ?? undefined}>
        {headerTitle}
      </CardTitle>
    </CardHeader>
  );
}

