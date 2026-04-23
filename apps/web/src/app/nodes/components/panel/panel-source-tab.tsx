'use client';

import { useAtom } from 'jotai';
import { useAtomValue } from 'jotai';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CodeJar } from '@/components/ui/code-jar';
import { Label } from '@/components/ui/label';
import {
  nodesEditActiveAtom,
  nodesSaveErrorAtom,
  nodesSourceDraftAtom,
  nodesVisibleDetailAtom,
} from '@/models/nodes/edit.atom';
import { nodesSelectedIdAtom } from '@/models/nodes/selection.atom';

export function PanelSourceTab() {
  const [selectedId] = useAtom(nodesSelectedIdAtom);
  const detail = useAtomValue(nodesVisibleDetailAtom);
  const editable = useAtomValue(nodesEditActiveAtom);
  const [sourceDraft, setSourceDraft] = useAtom(nodesSourceDraftAtom);
  const saveError = useAtomValue(nodesSaveErrorAtom);
  const placeholder = !selectedId ? '请从左侧选择一个节点。' : '加载中…';
  if (!detail) {
    return <p className="py-8 text-sm text-muted-foreground">{placeholder}</p>;
  }
  const canEditSource = editable;
  const codeJarId = `nodes-detail-source-${detail.id}`;
  const value = canEditSource ? (sourceDraft ?? detail.source) : detail.source;
  return (
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
            {...(canEditSource ? { readOnly: false as const, onChange: setSourceDraft } : { readOnly: true as const })}
            className="h-full min-h-0 w-full max-w-full flex-1 sm:min-h-0"
            aria-label="节点 Python 源码"
          />
        </div>
      </div>
    </div>
  );
}
