"use client";

import { useEffect, useMemo, useState } from "react";

import type {
  EvaluationProfilePublic,
  WorkflowNodeDto,
} from "@/lib/quant-agent-api";
import { listEvaluationNodeTypes } from "@/lib/quant-agent-api";
import type { EvaluationNodeTypeCatalogItemPublic } from "@/models";

export type MetricMetaEntry = {
  name: string;
};

type MetricVizMode = "auto" | "bars" | "bars_diverging" | "table" | "json" | "scalar";

const DEFAULT_MODE: MetricVizMode = "auto";

function metricDisplayName(
  metricId: string | null,
  metricMetaById: Record<string, MetricMetaEntry> | undefined,
): string | null {
  if (!metricId) return null;
  return metricMetaById?.[metricId]?.name ?? null;
}

function nodeTypeDef(
  catalogByType: Map<string, EvaluationNodeTypeCatalogItemPublic>,
  typeKey: string | undefined,
): EvaluationNodeTypeCatalogItemPublic | undefined {
  if (!typeKey) return undefined;
  return catalogByType.get(typeKey);
}

function isNumericRecord(v: unknown): v is Record<string, number> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const vals = Object.values(v as Record<string, unknown>);
  if (vals.length === 0) return false;
  return vals.every(
    (x) => typeof x === "number" && Number.isFinite(x as number),
  );
}

function maxAbs(values: number[]): number {
  let m = 0;
  for (const v of values) m = Math.max(m, Math.abs(v));
  return m > 0 ? m : 1e-9;
}

function formatSeriesRowKey(key: string, periodDayStyle: boolean): string {
  if (periodDayStyle && /^\d+$/.test(key)) return `${key} 日`;
  return key;
}

function NumericSeriesBarsPositive({
  data,
  periodDayStyle,
}: {
  data: Record<string, number>;
  periodDayStyle: boolean;
}) {
  const entries = Object.entries(data).sort(
    (a, b) => Number(a[0]) - Number(b[0]),
  );
  const maxV = Math.max(...entries.map(([, v]) => v), 1e-9);
  return (
    <div className="space-y-1.5">
      {entries.map(([k, v]) => (
        <div key={k} className="flex items-center gap-2 text-xs">
          <span
            className="min-w-20 max-w-48 shrink-0 truncate font-mono text-muted-foreground tabular-nums"
            title={formatSeriesRowKey(k, periodDayStyle)}
          >
            {formatSeriesRowKey(k, periodDayStyle)}
          </span>
          <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-sm bg-muted/60">
            <div
              className="h-full rounded-sm bg-primary/80"
              style={{ width: `${(v / maxV) * 100}%` }}
            />
          </div>
          <span className="w-18 shrink-0 text-right font-mono tabular-nums">
            {v.toFixed(4)}
          </span>
        </div>
      ))}
    </div>
  );
}

function NumericSeriesBarsDiverging({
  data,
  periodDayStyle,
}: {
  data: Record<string, number>;
  periodDayStyle: boolean;
}) {
  const entries = Object.entries(data).sort(
    (a, b) => Number(a[0]) - Number(b[0]),
  );
  const vals = entries.map(([, v]) => v);
  const scale = maxAbs(vals);
  return (
    <div className="space-y-1.5">
      {entries.map(([k, v]) => {
        const half = (Math.abs(v) / scale) * 50;
        return (
          <div key={k} className="flex items-center gap-2 text-xs">
            <span
              className="min-w-20 max-w-48 shrink-0 truncate font-mono text-muted-foreground tabular-nums"
              title={formatSeriesRowKey(k, periodDayStyle)}
            >
              {formatSeriesRowKey(k, periodDayStyle)}
            </span>
            <div className="relative h-2.5 min-w-0 flex-1 overflow-hidden rounded-sm bg-muted/60">
              <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
              {v >= 0 ? (
                <div
                  className="absolute top-0 bottom-0 left-1/2 rounded-r-sm bg-emerald-600/80 dark:bg-emerald-500/70"
                  style={{ width: `${half}%` }}
                />
              ) : (
                <div
                  className="absolute top-0 bottom-0 right-1/2 rounded-l-sm bg-rose-600/80 dark:bg-rose-500/70"
                  style={{ width: `${half}%` }}
                />
              )}
            </div>
            <span className="w-18 shrink-0 text-right font-mono tabular-nums">
              {v.toFixed(4)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function NumericSeriesBarsAbsFromLeft({
  data,
  periodDayStyle,
}: {
  data: Record<string, number>;
  periodDayStyle: boolean;
}) {
  const entries = Object.entries(data).sort(
    (a, b) => Number(a[0]) - Number(b[0]),
  );
  const scale = maxAbs(entries.map(([, v]) => v));
  return (
    <div className="space-y-1.5">
      {entries.map(([k, v]) => (
        <div key={k} className="flex items-center gap-2 text-xs">
          <span
            className="min-w-20 max-w-48 shrink-0 truncate font-mono text-muted-foreground tabular-nums"
            title={formatSeriesRowKey(k, periodDayStyle)}
          >
            {formatSeriesRowKey(k, periodDayStyle)}
          </span>
          <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-sm bg-muted/60">
            <div
              className={cnBarColor(v)}
              style={{ width: `${(Math.abs(v) / scale) * 100}%` }}
            />
          </div>
          <span className="w-18 shrink-0 text-right font-mono tabular-nums">
            {v.toFixed(4)}
          </span>
        </div>
      ))}
    </div>
  );
}

function cnBarColor(v: number): string {
  return v >= 0
    ? "h-full rounded-sm bg-emerald-600/75 dark:bg-emerald-500/65"
    : "h-full rounded-sm bg-rose-600/75 dark:bg-rose-500/65";
}

function NumericRecordTable({
  data,
  periodDayStyle,
}: {
  data: Record<string, number>;
  periodDayStyle: boolean;
}) {
  const entries = Object.entries(data).sort(
    (a, b) => Number(a[0]) - Number(b[0]),
  );
  return (
    <div className="overflow-x-auto rounded-md border border-border/60">
      <table className="w-full text-xs">
        <tbody>
          {entries.map(([k, v]) => (
            <tr
              key={k}
              className="border-b border-border/40 last:border-b-0"
            >
              <td className="px-2 py-1.5 font-mono text-muted-foreground">
                {formatSeriesRowKey(k, periodDayStyle)}
              </td>
              <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                {v.toFixed(6)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function effectiveBarMode(
  mode: MetricVizMode,
  data: Record<string, number>,
): "positive" | "diverging" | "abs_left" {
  const vals = Object.values(data);
  const hasNeg = vals.some((v) => v < 0);
  if (mode === "bars_diverging") return "diverging";
  if (mode === "bars") return hasNeg ? "abs_left" : "positive";
  /* auto */
  return hasNeg ? "diverging" : "positive";
}

function renderNumericRecord(
  data: Record<string, number>,
  mode: MetricVizMode,
  periodDayStyle: boolean,
) {
  const entries = Object.entries(data);
  if (mode === "scalar" && entries.length === 1) {
    const [k, v] = entries[0]!;
    return (
      <div className="rounded-md border border-border/60 bg-muted/10 px-3 py-3">
        <p className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
          {formatSeriesRowKey(k, periodDayStyle)}
        </p>
        <p className="mt-1 font-mono text-2xl font-semibold tabular-nums tracking-tight">
          {v.toFixed(6)}
        </p>
      </div>
    );
  }
  if (mode === "table") {
    return <NumericRecordTable data={data} periodDayStyle={periodDayStyle} />;
  }
  const bar = effectiveBarMode(mode, data);
  if (bar === "diverging") {
    return (
      <NumericSeriesBarsDiverging
        data={data}
        periodDayStyle={periodDayStyle}
      />
    );
  }
  if (bar === "abs_left") {
    return (
      <NumericSeriesBarsAbsFromLeft
        data={data}
        periodDayStyle={periodDayStyle}
      />
    );
  }
  return (
    <NumericSeriesBarsPositive data={data} periodDayStyle={periodDayStyle} />
  );
}

function workflowNodeTitle(
  profile: EvaluationProfilePublic | undefined,
  nodeId: string,
  metricMetaById: Record<string, MetricMetaEntry> | undefined,
  catalogByType: Map<string, EvaluationNodeTypeCatalogItemPublic>,
): string {
  const n = profile?.workflow?.nodes?.find((x) => x.id === nodeId);
  if (!n) return "工作流节点";
  const def = nodeTypeDef(catalogByType, n.type);
  const label = def?.label ?? n.type;
  const mid = def?.metric_id ?? null;
  if (mid) {
    const nm = metricDisplayName(mid, metricMetaById);
    if (nm) return `${label} · ${nm}`;
    return `${label} · ${mid.length > 12 ? `${mid.slice(0, 10)}…` : mid}`;
  }
  return label;
}

function outputSectionLabel(
  socketKey: string,
  node: WorkflowNodeDto | undefined,
  metricMetaById: Record<string, MetricMetaEntry> | undefined,
  catalogByType: Map<string, EvaluationNodeTypeCatalogItemPublic>,
): string {
  const def = nodeTypeDef(catalogByType, node?.type);
  if (socketKey === "out" && def?.metric_id) {
    const nm = metricDisplayName(def.metric_id, metricMetaById);
    if (nm) return nm;
  }
  const fromCatalog = def?.socket_labels?.[socketKey];
  if (fromCatalog) return fromCatalog;
  return socketKey;
}

function asObjectRecord(v: unknown): Record<string, unknown> | null {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

function periodDayStyleForSocket(
  socketKey: string,
  node: WorkflowNodeDto | undefined,
  catalogByType: Map<string, EvaluationNodeTypeCatalogItemPublic>,
): boolean {
  const def = nodeTypeDef(catalogByType, node?.type);
  return Boolean(def?.period_day_style_sockets?.includes(socketKey));
}

function renderScalarNumber(val: number) {
  return (
    <p className="font-mono text-xl font-semibold tabular-nums">
      {val.toFixed(6)}
    </p>
  );
}

export function EvaluationProfileMetricResultsPanel(props: {
  metricResults: Record<string, unknown>;
  profile?: EvaluationProfilePublic | null;
  /** Per registry metric id: display name（user metric 节点标题） */
  metricMetaById?: Record<string, MetricMetaEntry>;
}) {
  const { metricResults, profile, metricMetaById } = props;
  const [nodeCatalog, setNodeCatalog] = useState<EvaluationNodeTypeCatalogItemPublic[]>(
    [],
  );
  useEffect(() => {
    let cancelled = false;
    listEvaluationNodeTypes()
      .then((rows) => {
        if (!cancelled) setNodeCatalog(rows);
      })
      .catch(() => {
        /* 目录失败时退回 type 原样展示 */
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const catalogByType = useMemo(
    () => new Map(nodeCatalog.map((d) => [d.type, d])),
    [nodeCatalog],
  );

  const nodeIds = Object.keys(metricResults);
  if (nodeIds.length === 0) return null;

  const blocks = nodeIds.map((nid) => {
    const outs = asObjectRecord(metricResults[nid]);
    if (!outs) return null;
    const node = profile?.workflow?.nodes?.find((x) => x.id === nid);
    const entries = Object.entries(outs).filter(([sk, val]) => {
      if (sk === "clean_factor" && val === "[DataFrame]") return false;
      return true;
    });
    if (entries.length === 0) return null;
    return (
      <div
        key={nid}
        className="rounded-lg border border-border/70 bg-muted/15 p-3"
      >
        <p className="mb-2 text-sm font-medium">
          {workflowNodeTitle(
            profile ?? undefined,
            nid,
            metricMetaById,
            catalogByType,
          )}
        </p>
        <div className="space-y-3">
          {entries.map(([socketKey, val]) => {
            const skLabel = outputSectionLabel(
              socketKey,
              node,
              metricMetaById,
              catalogByType,
            );
            const periodDay = periodDayStyleForSocket(
              socketKey,
              node,
              catalogByType,
            );
            if (isNumericRecord(val)) {
              return (
                <div key={socketKey}>
                  <p className="mb-1.5 text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
                    {skLabel}
                  </p>
                  {renderNumericRecord(val, DEFAULT_MODE, periodDay)}
                </div>
              );
            }
            if (typeof val === "number" && Number.isFinite(val)) {
              return (
                <div
                  key={socketKey}
                  className="flex flex-col gap-1 text-xs"
                >
                  <span className="text-muted-foreground">{skLabel}</span>
                  {renderScalarNumber(val)}
                </div>
              );
            }
            if (typeof val === "string") {
              return (
                <div key={socketKey} className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground/80">
                    {skLabel}
                  </span>
                  {": "}
                  {val}
                </div>
              );
            }
            return null;
          })}
        </div>
      </div>
    );
  });

  const visible = blocks.filter(Boolean);
  if (visible.length === 0) return null;

  return (
    <div className="space-y-4 border-t border-border/60 pt-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        工作流节点输出
      </p>
      {visible}
    </div>
  );
}
