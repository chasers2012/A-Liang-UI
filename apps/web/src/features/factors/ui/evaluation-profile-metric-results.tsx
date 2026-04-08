"use client";


import { useMemo } from "react";

import { EchartsOptionChart } from "@/components/echarts/echarts-option-chart";
import type { FactorEvaluationRowPublic } from "@/models";

type EchartsPayload = { type: "echart"; option: unknown };

function isEchartsPayload(v: unknown): v is EchartsPayload {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return o.type === "echart" && "option" in o;
}

/**
 * 与后端 `profile_workflow_runner._extract_collected_result` + `_to_jsonable` 对齐：
 * 单 Collect 节点时常见为 `[[ structured, ...echart ]]`（外层多包一层数组），需展开一层再遍历。
 * 若结果被序列化成字符串，则先 JSON.parse。
 */
function normalizeEvalResults(raw: unknown): unknown {
  if (raw == null) return raw;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return raw;
    }
  }
  if (Array.isArray(raw) && raw.length === 1 && Array.isArray(raw[0])) {
    return raw[0];
  }
  return raw;
}

/** 深度遍历评价结果，收集所有 `EchartsLineNode` 输出的 `{ type: "echart", option }`（一节点一图，结果里可出现多个）。 */
function collectEchartsPayloads(value: unknown): EchartsPayload[] {
  const out: EchartsPayload[] = [];
  const visited = new Set<unknown>();

  const walk = (v: unknown, depth: number) => {
    if (depth > 50) return;
    if (v && (typeof v === "object" || typeof v === "function")) {
      if (visited.has(v)) return;
      visited.add(v);

      if (isEchartsPayload(v)) {
        out.push(v);
        return;
      }

      if (Array.isArray(v)) {
        for (const item of v) walk(item, depth + 1);
      } else {
        for (const item of Object.values(v as Record<string, unknown>)) {
          walk(item, depth + 1);
        }
      }
    }
  };

  walk(value, 0);
  return out;
}

export function EvaluationProfileMetricResultsPanel(props: {
  evalRow: FactorEvaluationRowPublic;
}) {
  const { evalRow } = props;

  const charts = useMemo(
    () => collectEchartsPayloads(normalizeEvalResults(evalRow.results)),
    [evalRow.results],
  );

  if (evalRow.results == null) {
    return (
      <p className="text-sm text-muted-foreground">
        当前评价没有工作流节点输出。
      </p>
    );
  }

  if (charts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        未找到 ECharts 图表数据（工作流需包含 `EchartsLineNode` 节点输出）。
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {charts.map((p, idx) => (
        <div key={idx} className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">
            {charts.length === 1 ? "ECharts 图表" : `ECharts 图表 #${idx + 1}`}
          </div>
          <EchartsOptionChart option={p.option} />
        </div>
      ))}
    </div>
  );
}
