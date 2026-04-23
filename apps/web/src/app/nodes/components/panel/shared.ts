'use client';

import { inputSpecToNodeParamModel, isWireInputSpec } from '@/components/workflow-graph/workflow-node-input-spec';
import type { NodeDetailPublic } from '@/models/nodes/dto';

export function mergePreviewParamModels(detail: NodeDetailPublic) {
  const inlineFromInputs = detail.inputs.filter((s) => !isWireInputSpec(s)).map(inputSpecToNodeParamModel);
  const byKey = new Map<string, (typeof inlineFromInputs)[number]>();
  for (const p of inlineFromInputs) if (!byKey.has(p.key)) byKey.set(p.key, p);
  return [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key, 'zh-Hans-CN'));
}
