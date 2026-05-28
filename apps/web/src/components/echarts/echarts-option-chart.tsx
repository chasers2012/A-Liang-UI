'use client';

import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

import * as echarts from 'echarts';

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

  // 只用于触发 setOption 更新；option 可能很大，避免多余 effect 依赖导致反复加载 echarts。
  const optionKey = useMemo(() => {
    try {
      return typeof option === 'object' && option != null ? JSON.stringify(option) : String(option);
    } catch {
      return String(option);
    }
  }, [option]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let resizeObserver: ResizeObserver | null = null;

    if (!chartRef.current) {
      chartRef.current = echarts.init(root);

      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => chartRef.current?.resize());
        resizeObserver.observe(root);
      }
    }

    try {
      chartRef.current?.setOption(option as echarts.EChartsOption, true);
      chartRef.current?.resize();
      setError(null);
    } catch (e) {
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
    <div ref={rootRef} className={className ?? 'relative h-[360px] min-h-[360px] w-full min-w-0'} style={style}>
      {error ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}
    </div>
  );
}
