'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CodeJar } from '@/components/ui/code-jar';
import { Label } from '@/components/ui/label';
import type { NodeDetailPublic } from '@/models/nodes/dto';
import { applyNameToWorkflowNodeLabel } from '@/models/nodes/template.atom';

export function PanelSourceTab(props: {
  detail: NodeDetailPublic | null;
  placeholder: string;
  editable?: boolean;
  editName?: string;
  sourceDraft?: string;
  onSourceDraftChange?: (source: string) => void;
  saveError?: string | null;
}) {
  const {
    detail,
    placeholder,
    editable = false,
    editName = '',
    sourceDraft = '',
    onSourceDraftChange,
    saveError = null,
  } = props;
  if (!detail) {
    return (
      <div className="flex h-full min-h-0 w-full flex-1 flex-col px-6 pb-6 pt-2">
        <p className="py-8 text-sm text-muted-foreground">{placeholder}</p>
      </div>
    );
  }
  const canEditSource = editable && !!onSourceDraftChange;
  const codeJarId = `nodes-detail-source-${detail.id}`;
  const value = canEditSource
    ? editName.trim()
      ? applyNameToWorkflowNodeLabel(sourceDraft, editName.trim())
      : sourceDraft
    : detail.source;
  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col px-6 pb-6 pt-2">
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        {canEditSource && saveError ? (
          <Alert variant="destructive">
            <AlertTitle>无法保存</AlertTitle>
            <AlertDescription>{saveError}</AlertDescription>
          </Alert>
        ) : null}
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <Label htmlFor={codeJarId}>源码</Label>
          <div className="min-h-0 flex-1">
            <CodeJar
              key={detail.id}
              id={codeJarId}
              value={value}
              {...(canEditSource
                ? { readOnly: false as const, onChange: onSourceDraftChange }
                : { readOnly: true as const })}
              className="h-full min-h-0 w-full max-w-full flex-1 sm:min-h-0"
              aria-label="节点 Python 源码"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
