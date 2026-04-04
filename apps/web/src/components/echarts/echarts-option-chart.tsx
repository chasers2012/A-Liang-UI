"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import * as echarts from "echarts";

export type EchartsOptionChartProps = {
  option: unknown;
  className?: string;
  style?: CSSProperties;
};

export function EchartsOptionChart(props: EchartsOptionChartProps) {
  const { option, className, style } = props;

  const rootRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const [error, setError] = useState<string | null>(null);
  const errorForOptionKeyRef = useRef<string | null>(null);

  // 只用于触发 setOption 更新；option 可能很大，避免多余 effect 依赖导致反复加载 echarts。
  const optionKey = useMemo(() => {
    try {
      return typeof option === "object" && option != null
        ? JSON.stringify(option)
        : String(option);
    } catch {
      return String(option);
    }
  }, [option]);

  useEffect(() => {
    let resizeObserver: ResizeObserver | null = null;

    if (!rootRef.current) return;

    if (!chartRef.current) {
      chartRef.current = echarts.init(rootRef.current);

      if (typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(() => chartRef.current?.resize());
        resizeObserver.observe(rootRef.current);
      }
    }

    try {
      chartRef.current.setOption(option as echarts.EChartsOption, true);
    } catch (e) {
      errorForOptionKeyRef.current = optionKey;
      setError(e instanceof Error ? e.message : String(e));
    }

    return () => {
      resizeObserver?.disconnect();
      resizeObserver = null;
      chartRef.current?.dispose?.();
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optionKey]);

  return (
    <div
      ref={rootRef}
      className={className ?? "h-[360px] w-full"}
      style={style}
    >
      {error ? (
        errorForOptionKeyRef.current === optionKey ? (
        <div className="flex h-full items-center justify-center p-4 text-sm text-destructive">
          {error}
        </div>
        ) : null
      ) : null}
    </div>
  );
}

