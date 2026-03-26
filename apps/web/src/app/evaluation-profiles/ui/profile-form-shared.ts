import type {
  EvaluationWorkflowDto,
  WorkflowLinkDto,
  WorkflowNodeDto,
} from "@/lib/quant-agent-api";

export function parsePeriodsCsv(s: string): number[] {
  return s
    .split(/[,，\s]+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => Number(x))
    .filter((n) => !Number.isNaN(n));
}

export const DEFAULT_WORKFLOW_JSON = `{
  "nodes": [],
  "links": []
}`;

export const EMPTY_EVALUATION_WORKFLOW: EvaluationWorkflowDto = {
  nodes: [],
  links: [],
};

export function parseEvaluationWorkflowJson(s: string):
  | { ok: true; value: EvaluationWorkflowDto }
  | { ok: false; error: string } {
  try {
    const raw = JSON.parse(s) as unknown;
    if (!raw || typeof raw !== "object") {
      return { ok: false, error: "工作流须为 JSON 对象" };
    }
    const o = raw as Record<string, unknown>;
    const nodes = Array.isArray(o.nodes) ? o.nodes : [];
    const links = Array.isArray(o.links) ? o.links : [];
    const vp = o.viewport;
    let viewport: EvaluationWorkflowDto["viewport"] = null;
    if (vp && typeof vp === "object" && vp !== null) {
      const r = vp as Record<string, unknown>;
      viewport = {
        x: Number(r.x) || 0,
        y: Number(r.y) || 0,
        zoom: Number(r.zoom) || 1,
      };
    }
    return {
      ok: true,
      value: {
        nodes: nodes as WorkflowNodeDto[],
        links: links as WorkflowLinkDto[],
        viewport,
      },
    };
  } catch {
    return { ok: false, error: "工作流 JSON 无法解析" };
  }
}
