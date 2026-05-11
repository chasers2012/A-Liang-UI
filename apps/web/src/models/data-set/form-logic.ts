import type { WorkflowGraphPersisted } from '@/components/workflow-graph/reactflow/types';
import { parsePersistedWorkflowGraphPayload } from '@/components/workflow-graph';

import type { DataSetPublic } from './dto';

export type DataSetBindingFormRow = {
  datasource_id: string;
  columns: string[];
};

export type DataSetFormState = {
  name: string;
  description: string;
  bindings: DataSetBindingFormRow[];
  preprocessing_workflow: WorkflowGraphPersisted;
  start: string;
  end: string;
  instrument_codes_text: string;
};

export function emptyDataSetForm(template?: WorkflowGraphPersisted): DataSetFormState {
  const preprocessingWorkflow = template ?? parsePersistedWorkflowGraphPayload({});
  return {
    name: '',
    description: '',
    bindings: [
      {
        datasource_id: '',
        columns: [],
      },
    ],
    preprocessing_workflow: preprocessingWorkflow,
    start: '2023-01-01',
    end: '2024-12-31',
    instrument_codes_text: '',
  };
}

export function sameWorkflowGraph(a: WorkflowGraphPersisted, b: WorkflowGraphPersisted): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function toDateInputValue(s: string): string {
  const t = (s || '').trim();
  if (t.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  return t;
}

export function hydrateDataSetForm(row: DataSetPublic): DataSetFormState {
  const bindings =
    row.datasource_bindings.length > 0
      ? row.datasource_bindings.map((b) => ({
          datasource_id: b.datasource_id,
          columns: b.columns ?? [],
        }))
      : [
          {
            datasource_id: '',
            columns: [],
          },
        ];
  return {
    name: row.name,
    description: row.description,
    bindings,
    preprocessing_workflow: row.preprocessing_workflow,
    start: toDateInputValue(row.start),
    end: toDateInputValue(row.end),
    instrument_codes_text: row.instrument_codes.length ? row.instrument_codes.join('\n') : '',
  };
}

export function parseInstrumentCodesFromText(text: string): string[] {
  const parts = text.split(/[\s,;，；]+/u);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of parts) {
    const c = p.trim();
    if (!c || seen.has(c)) continue;
    seen.add(c);
    out.push(c);
  }
  return out;
}

function safeParseJsonObject(text: string): Record<string, unknown> {
  const raw = text.trim();
  if (!raw) return {};
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('config 必须是 JSON object（形如 { ... }）');
  }
  return parsed as Record<string, unknown>;
}

export function validateDataSetBindings(bindings: DataSetBindingFormRow[]): string | null {
  if (!bindings.length) return '至少保留一条数据源绑定';
  if (bindings.length > 1) return '不支持多数据源绑定（请仅配置一条绑定）';
  for (const b of bindings) {
    if (!b.datasource_id.trim()) return '每条绑定须选择数据源';
  }
  return null;
}

export function validatePreprocessingWorkflow(workflow: WorkflowGraphPersisted): string | null {
  for (const node of workflow.nodes) {
    const params = node.params ?? {};
    const cfg = params['config_json'];
    if (typeof cfg === 'string' && cfg.trim()) {
      try {
        safeParseJsonObject(cfg);
      } catch (e) {
        return e instanceof Error ? e.message : String(e);
      }
    }
  }
  return null;
}
