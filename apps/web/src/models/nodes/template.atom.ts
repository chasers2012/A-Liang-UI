import { getNodeTemplate } from '@/api/nodes';
import { toAsyncValueStateAtom } from '@/lib/loadable';
import { atom } from 'jotai';

export function applyNameToWorkflowNodeLabel(src: string, label: string) {
  const escaped = label.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return src.replace(
    /(@workflow_node\([\s\S]*?\blabel=")([^"]*)(")/,
    (_: string, prefix: string, _oldLabel: string, suffix: string) => {
      return `${prefix}${escaped}${suffix}`;
    },
  );
}

export function applyTimestampSuffixToWorkflowNodeClassName(src: string, now = new Date()) {
  const toPascalCase = (raw: string) =>
    raw
      .replace(/[^a-zA-Z0-9]+/g, ' ')
      .split(' ')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join('');
  const timestamp = [
    now.getFullYear().toString(),
    (now.getMonth() + 1).toString().padStart(2, '0'),
    now.getDate().toString().padStart(2, '0'),
    now.getHours().toString().padStart(2, '0'),
    now.getMinutes().toString().padStart(2, '0'),
    now.getSeconds().toString().padStart(2, '0'),
  ].join('');

  return src.replace(
    /^(\s*class\s+)([A-Za-z_][A-Za-z0-9_]*)(\s*(?:\(|:))/m,
    (_: string, prefix: string, oldName: string, suffix: string) => {
      const normalized = toPascalCase(oldName) || 'WorkflowNode';
      return `${prefix}${normalized}${timestamp}${suffix}`;
    },
  );
}

export const getNodeTemplateAtom = atom(async () => await getNodeTemplate());

export const nodeTemplateAsyncStateAtom = toAsyncValueStateAtom(getNodeTemplateAtom);
