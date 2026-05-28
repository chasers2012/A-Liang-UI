import type { AssistantBlock } from '@/models/chat/types';

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

type TaskToolBlock = Extract<AssistantBlock, { kind: 'tool' }>;

function normalizeSegmentId(v: string | undefined | null): string {
  return (v ?? '').trim();
}

/** task 归属段：优先使用 ``run_segment_id``，兼容旧数据回退到 ``tool_call_id``。 */
function taskOwnSegmentId(task: TaskToolBlock): string {
  return normalizeSegmentId(task.run_segment_id) || normalizeSegmentId(task.call.id);
}

export type SubagentTaskShell = {
  kind: 'subagent_task_shell';
  taskBlock: TaskToolBlock;
  nested: AssistantBlock[];
};

function appendWithReasoningMerge(target: AssistantBlock[], block: AssistantBlock): void {
  const last = target[target.length - 1];
  if (last?.kind === 'reasoning' && block.kind === 'reasoning') {
    target[target.length - 1] = {
      ...last,
      content: `${last.content}${block.content}`,
      run_segment_id: block.run_segment_id ?? last.run_segment_id,
    };
    return;
  }
  if (last?.kind === 'text' && block.kind === 'text') {
    target[target.length - 1] = {
      ...last,
      content: `${last.content}${block.content}`,
      run_segment_id: block.run_segment_id ?? last.run_segment_id,
      completed: block.completed ?? last.completed,
    };
    return;
  }
  target.push(block);
}

function appendTopLevelWithReasoningMerge(
  target: Array<AssistantBlock | SubagentTaskShell>,
  block: AssistantBlock,
): void {
  const last = target[target.length - 1];
  if (!last || isSubagentTaskShell(last)) {
    target.push(block);
    return;
  }
  if (last.kind === 'reasoning' && block.kind === 'reasoning') {
    target[target.length - 1] = {
      ...last,
      content: `${last.content}${block.content}`,
      run_segment_id: block.run_segment_id ?? last.run_segment_id,
    };
    return;
  }
  if (last.kind === 'text' && block.kind === 'text') {
    target[target.length - 1] = {
      ...last,
      content: `${last.content}${block.content}`,
      run_segment_id: block.run_segment_id ?? last.run_segment_id,
      completed: block.completed ?? last.completed,
    };
    return;
  }
  target.push(block);
}

/** 将扁平块序列变为「普通块 | task 外壳」交错列表。仅支持一层 subagent shell。 */
export function buildAssistantRenderSequence(blocks: AssistantBlock[]): Array<AssistantBlock | SubagentTaskShell> {
  const out: Array<AssistantBlock | SubagentTaskShell> = [];
  const shellBySegment = new Map<string, SubagentTaskShell>();

  for (const block of blocks) {
    const segmentId = normalizeSegmentId(block.run_segment_id);
    const ownerShell = segmentId ? shellBySegment.get(segmentId) : undefined;

    if (isTaskToolBlock(block)) {
      const ownSegmentId = taskOwnSegmentId(block);

      // 一层限制：子 task 不再创建 shell，直接作为父 shell 内的普通工具块。
      if (ownerShell) {
        appendWithReasoningMerge(ownerShell.nested, block);
        if (ownSegmentId) {
          shellBySegment.set(ownSegmentId, ownerShell);
        }
        continue;
      }

      const shell: SubagentTaskShell = { kind: 'subagent_task_shell', taskBlock: block, nested: [] };
      out.push(shell);
      if (ownSegmentId) {
        shellBySegment.set(ownSegmentId, shell);
      }
      continue;
    }

    if (ownerShell) {
      appendWithReasoningMerge(ownerShell.nested, block);
      continue;
    }
    appendTopLevelWithReasoningMerge(out, block);
  }
  return out;
}

export type PlainOrShellRun = { kind: 'plain'; blocks: AssistantBlock[] } | { kind: 'shell'; shell: SubagentTaskShell };

export function isSubagentTaskShell(x: AssistantBlock | SubagentTaskShell): x is SubagentTaskShell {
  return (x as SubagentTaskShell).kind === 'subagent_task_shell';
}

export function partitionAssistantRuns(blocks: AssistantBlock[]): PlainOrShellRun[] {
  const seq = buildAssistantRenderSequence(blocks);
  const runs: PlainOrShellRun[] = [];

  for (const item of seq) {
    if (isSubagentTaskShell(item)) {
      runs.push({ kind: 'shell', shell: item });
      continue;
    }
    const last = runs[runs.length - 1];
    if (last?.kind === 'plain') {
      last.blocks.push(item);
      continue;
    }
    runs.push({ kind: 'plain', blocks: [item] });
  }

  return runs;
}
