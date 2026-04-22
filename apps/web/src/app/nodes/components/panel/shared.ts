'use client';

import { inputSpecToNodeParamModel, isWireInputSpec } from '@/components/workflow-graph/workflow-node-input-spec';
import type { NodeDetailPublic } from '@/models/nodes/dto';

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
