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

export function parseMaxLoss(maxLoss: string): number {
  const ml = Number(maxLoss);
  if (Number.isNaN(ml)) throw new Error("max_loss 须为数字");
  return ml;
}

export function parseQuantilesInput(quantiles: string): number | null {
  const qRaw = quantiles.trim();
  const q = qRaw === "" ? null : Number(qRaw);
  if (qRaw !== "" && (Number.isNaN(q) || q === null || q < 2)) {
    throw new Error("quantiles 须为空或 >= 2 的整数");
  }
  return q;
}

export const DEFAULT_WORKFLOW_JSON = `{
  "nodes": [],
  "links": []
}`;

export const EMPTY_EVALUATION_WORKFLOW: EvaluationWorkflowDto = {
  nodes: [],
  links: [],
};

export function parseEvaluationWorkflowJson(s: string): EvaluationWorkflowDto {
  let raw: unknown;
  try {
    raw = JSON.parse(s) as unknown;
  } catch {
    throw new Error("工作流 JSON 无法解析");
  }
  if (!raw || typeof raw !== "object") {
    throw new Error("工作流须为 JSON 对象");
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
    nodes: nodes as WorkflowNodeDto[],
    links: links as WorkflowLinkDto[],
    viewport,
  };
}
