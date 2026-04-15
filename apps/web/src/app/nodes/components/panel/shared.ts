'use client';

import { inputSpecToNodeParamModel, isWireInputSpec } from '@/components/workflow-graph/workflow-node-input-spec';
import type { NodeDetailPublic } from '@/models/nodes/dto';

export const PREVIEW_SCROLL_CLASS = 'h-full max-h-[calc(100vh-10rem)] px-6 pb-6 pt-2';

export const NODE_PAGE_CARD_TOOLBAR =
  'flex w-full shrink-0 flex-row items-center justify-between gap-2 border-b px-4 pb-3 pt-0';

export const TAB_TRIGGER_CLASS =
  'inline-flex items-center justify-center rounded-md px-3 py-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[active]:bg-background data-[active]:text-foreground data-[active]:shadow-sm';

export const EMPTY_HINT = '请从左侧选择一个节点。';

export function applyNameToWorkflowNodeLabel(src: string, label: string) {
  const escaped = label.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return src.replace(
    /(@workflow_node\([\s\S]*?\blabel=")([^"]*)(")/,
    (_: string, prefix: string, _oldLabel: string, suffix: string) => `${prefix}${escaped}${suffix}`,
  );
}

export function mergePreviewParamModels(detail: NodeDetailPublic) {
  const inlineFromInputs = detail.inputs.filter((s) => !isWireInputSpec(s)).map(inputSpecToNodeParamModel);
  const byKey = new Map<string, (typeof inlineFromInputs)[number]>();
  for (const p of inlineFromInputs) if (!byKey.has(p.key)) byKey.set(p.key, p);
  return [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key, 'zh-Hans-CN'));
}
