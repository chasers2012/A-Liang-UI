import type { AssistantBlock } from '@/models/chat/types';

/** 与同一路径前缀的并行分支对齐：整块共享同一 ``run_segment_id`` */
export function blockStreamPartitionKey(block: AssistantBlock): string {
  return (block.run_segment_id ?? '').trim();
}

/** UI 展示的短标签：路径最后一段（或截断全文） */
export function formatSegmentLabel(runSegmentId: string | undefined | null): string | null {
  const s = runSegmentId?.trim();
  if (!s) return null;
  const parts = s.split('/').filter(Boolean);
  const last = parts[parts.length - 1];
  const raw = last || s;
  return raw.length > 48 ? `${raw.slice(0, 45)}…` : raw;
}

export function parseTaskToolArgs(args: unknown): { description: string; subagentType: string } {
  let obj: unknown = args;
  if (typeof args === 'string') {
    try {
      obj = JSON.parse(args) as unknown;
    } catch {
      return { description: '', subagentType: '' };
    }
  }
  if (!obj || typeof obj !== 'object') {
    return { description: '', subagentType: '' };
  }
  const o = obj as Record<string, unknown>;
  const description = typeof o.description === 'string' ? o.description : '';
  const subagentType = typeof o.subagent_type === 'string' ? o.subagent_type : '';
  return { description, subagentType };
}

function isTaskToolBlock(b: AssistantBlock): b is Extract<AssistantBlock, { kind: 'tool' }> {
  return b.kind === 'tool' && b.call.name?.toLowerCase() === 'task';
}

/** ``run_segment_id`` 是否对应同一 tool_call。 */
function isSameToolCallSegment(childSeg: string | undefined, toolCallId: string | undefined): boolean {
  const c = childSeg?.trim();
  const p = toolCallId?.trim();
  if (!p) return false;
  if (!c) return false;
  return c === p;
}

/**
 * 紧跟在某个 `task` 工具块之后、属于该次委派的内容（含子代理内再次 task 及其子树）。
 * 在后端已将 ``run_segment_id`` 映射为 ``tool_call_id`` 后，归属关系按 id 等值判断：
 * - 普通块：``block.run_segment_id === parentTask.call.id``
 * - 子 task 块：``taskBlock.run_segment_id === parentTask.call.id``
 */
export function extractTaskNestedBlocks(
  blocks: AssistantBlock[],
  taskIdx: number,
): { nested: AssistantBlock[]; nextIndex: number } {
  const task = blocks[taskIdx];
  if (!isTaskToolBlock(task)) {
    return { nested: [], nextIndex: taskIdx + 1 };
  }

  const parentToolCallId = task.call.id?.trim();
  if (!parentToolCallId) {
    return { nested: [], nextIndex: taskIdx + 1 };
  }

  const nested: AssistantBlock[] = [];
  let j = taskIdx + 1;

  while (j < blocks.length) {
    const b = blocks[j];

    if (isTaskToolBlock(b)) {
      if (!isSameToolCallSegment(b.run_segment_id, parentToolCallId)) break;
      const inner = extractTaskNestedBlocks(blocks, j);
      nested.push(b, ...inner.nested);
      j = inner.nextIndex;
      continue;
    }

    if (isSameToolCallSegment(b.run_segment_id, parentToolCallId)) {
      nested.push(b);
      j++;
      continue;
    }

    break;
  }

  return { nested, nextIndex: j };
}

export type SubagentTaskShell = {
  kind: 'subagent_task_shell';
  taskBlock: Extract<AssistantBlock, { kind: 'tool' }>;
  nested: AssistantBlock[];
};

/** 将扁平块序列变为「普通块 | task 外壳」交错列表，供嵌套区域递归渲染。 */
export function buildAssistantRenderSequence(blocks: AssistantBlock[]): Array<AssistantBlock | SubagentTaskShell> {
  const out: Array<AssistantBlock | SubagentTaskShell> = [];
  let i = 0;
  while (i < blocks.length) {
    const b = blocks[i];
    if (isTaskToolBlock(b)) {
      const { nested, nextIndex } = extractTaskNestedBlocks(blocks, i);
      out.push({ kind: 'subagent_task_shell', taskBlock: b, nested });
      i = nextIndex;
    } else {
      out.push(b);
      i++;
    }
  }
  return out;
}

export type PlainOrShellRun = { kind: 'plain'; blocks: AssistantBlock[] } | { kind: 'shell'; shell: SubagentTaskShell };

export function isSubagentTaskShell(x: AssistantBlock | SubagentTaskShell): x is SubagentTaskShell {
  return (x as SubagentTaskShell).kind === 'subagent_task_shell';
}

export function partitionAssistantRuns(blocks: AssistantBlock[]): PlainOrShellRun[] {
  const runs: PlainOrShellRun[] = [];
  let plain: AssistantBlock[] = [];
  let i = 0;
  while (i < blocks.length) {
    const b = blocks[i];
    if (isTaskToolBlock(b)) {
      if (plain.length) {
        runs.push({ kind: 'plain', blocks: plain });
        plain = [];
      }
      const { nested, nextIndex } = extractTaskNestedBlocks(blocks, i);
      runs.push({
        kind: 'shell',
        shell: { kind: 'subagent_task_shell', taskBlock: b, nested },
      });
      i = nextIndex;
    } else {
      plain.push(b);
      i++;
    }
  }
  if (plain.length) runs.push({ kind: 'plain', blocks: plain });
  return runs;
}
