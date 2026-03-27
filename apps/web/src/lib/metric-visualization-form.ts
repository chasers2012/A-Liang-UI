import type { MetricVisualizationMode } from "@/models/evaluation-metric/dto";

export const METRIC_VIZ_MODE_ITEMS: {
  value: MetricVisualizationMode;
  label: string;
}[] = [
  { value: "auto", label: "自动（按数值是否含负推断条形样式）" },
  { value: "bars", label: "条形图（非负从左填充；含负时按绝对长度从左）" },
  { value: "bars_diverging", label: "双向条形图（零轴居中）" },
  { value: "table", label: "表格" },
  { value: "json", label: "JSON 原文" },
  { value: "scalar", label: "大号单值（仅一项数值时）" },
];
