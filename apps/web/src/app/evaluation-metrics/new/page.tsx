"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createEvaluationMetric,
  type MetricVisualizationMode,
} from "@/lib/quant-agent-api";
import { METRIC_VIZ_MODE_ITEMS } from "@/lib/metric-visualization-form";

import { FactorCodeJar } from "@/app/factors/ui/factor-code-jar";
import {
  FactorFormPageContainer,
  FactorFormPageHeader,
} from "@/app/factors/ui/factor-form-page";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function NewEvaluationMetricPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [source, setSource] = useState("");
  const [vizMode, setVizMode] =
    useState<MetricVisualizationMode>("auto");
  const [vizPeriodDayKeys, setVizPeriodDayKeys] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const created = await createEvaluationMetric({
        name: name.trim(),
        description: description.trim(),
        ...(source.trim() ? { source: source.trim() } : {}),
        visualization: {
          mode: vizMode,
          period_day_keys: vizPeriodDayKeys,
        },
      });
      router.push(`/evaluation-metrics/${encodeURIComponent(created.id)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FactorFormPageContainer>
      <FactorFormPageHeader title="新增评价指标" />
      <form className="flex flex-col gap-6" onSubmit={(e) => void onSubmit(e)}>
        {error && (
          <Alert variant="destructive">
            <AlertTitle>无法保存</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="em-name">名称（Python 标识符）</Label>
            <Input
              id="em-name"
              className="font-mono text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my_metric"
              autoComplete="off"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="em-desc">描述</Label>
            <Textarea
              id="em-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="em-viz">结果可视化</Label>
            <p className="text-xs text-muted-foreground">
              可覆盖模板源码中的 VISUALIZATION；因子详情页按此展示该指标的输出。
            </p>
            <Select
              value={vizMode}
              onValueChange={(v) => v && setVizMode(v as MetricVisualizationMode)}
            >
              <SelectTrigger id="em-viz" size="sm" className="max-w-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METRIC_VIZ_MODE_ITEMS.map((it) => (
                  <SelectItem key={it.value} value={it.value}>
                    {it.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 rounded border-input"
                checked={vizPeriodDayKeys}
                onChange={(e) => setVizPeriodDayKeys(e.target.checked)}
              />
              <span>键名为纯数字时显示为「N 日」</span>
            </label>
          </div>
        </div>
        <div className="space-y-2">
          <Label>源码（可选，留空使用模板）</Label>
          <FactorCodeJar
            id="new-evaluation-metric-source"
            value={source}
            onChange={setSource}
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={submitting || !name.trim()}>
            {submitting ? "保存中…" : "创建"}
          </Button>
          <Link
            href="/evaluation-metrics"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            取消
          </Link>
        </div>
      </form>
    </FactorFormPageContainer>
  );
}
