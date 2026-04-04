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

function optionHasLineSeries(option: unknown): boolean {
  if (!option || typeof option !== "object") return false;
  const o = option as Record<string, unknown>;
  const series = o.series;
  if (!Array.isArray(series)) return false;
  return series.some((s) => {
    if (!s || typeof s !== "object") return false;
    const ss = s as Record<string, unknown>;
    return ss.type === "line";
  });
}

function collectEchartsLinePayloads(value: unknown): EchartsPayload[] {
  const out: EchartsPayload[] = [];
  const visited = new Set<unknown>();

  const walk = (v: unknown, depth: number) => {
    if (depth > 50) return;
    if (v && (typeof v === "object" || typeof v === "function")) {
      if (visited.has(v)) return;
      visited.add(v);

      if (isEchartsPayload(v)) {
        if (optionHasLineSeries(v.option)) out.push(v);
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

  const lineCharts = useMemo(
    () => collectEchartsLinePayloads(evalRow.results ?? evalRow.metric_results),
    [evalRow.results, evalRow.metric_results],
  );

  if (!(evalRow.results ?? evalRow.metric_results)) {
    return (
      <p className="text-sm text-muted-foreground">
        当前评价没有工作流节点输出。
      </p>
    );
  }

  if (lineCharts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        未找到 `EchartsLineNode` 的可视化数据（或不是线图系列）。
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {lineCharts.map((p, idx) => (
        <div key={idx} className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">
            ECharts 线图 #{idx + 1}
          </div>
          <EchartsOptionChart option={p.option} />
        </div>
      ))}
    </div>
  );
}
