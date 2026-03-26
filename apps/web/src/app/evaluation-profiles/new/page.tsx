"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createEvaluationProfile,
  listEvaluationMetrics,
  listEvaluationNodeTypes,
  listEvaluationTestSets,
  type EvaluationMetricSummaryPublic,
  type EvaluationTestSetPublic,
  type NodeTypeDefinitionPublic,
} from "@/lib/quant-agent-api";
import {
  EvaluationWorkflowCanvas,
  type EvaluationWorkflowCanvasHandle,
} from "../ui/evaluation-workflow-canvas";

import {
  FactorFormPageContainer,
  FactorFormPageHeader,
} from "@/app/factors/ui/factor-form-page";
import {
  DEFAULT_WORKFLOW_JSON,
  EMPTY_EVALUATION_WORKFLOW,
  parseEvaluationWorkflowJson,
  parsePeriodsCsv,
} from "../ui/profile-form-shared";

export default function NewEvaluationProfilePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [testSetId, setTestSetId] = useState<string>("__none__");
  const [isDefault, setIsDefault] = useState(false);
  const [periodsCsv, setPeriodsCsv] = useState("1,5,10,20");
  const [quantiles, setQuantiles] = useState("");
  const [longShort, setLongShort] = useState(true);
  const [maxLoss, setMaxLoss] = useState("0.5");
  const [workflowJson, setWorkflowJson] = useState(DEFAULT_WORKFLOW_JSON);
  const [workflowEditMode, setWorkflowEditMode] = useState<"canvas" | "json">(
    "canvas",
  );
  const [canvasKey, setCanvasKey] = useState(0);
  const canvasRef = useRef<EvaluationWorkflowCanvasHandle>(null);
  const [catalog, setCatalog] = useState<NodeTypeDefinitionPublic[]>([]);
  const [metrics, setMetrics] = useState<EvaluationMetricSummaryPublic[]>([]);
  const [wfMetaLoading, setWfMetaLoading] = useState(true);
  const [testSets, setTestSets] = useState<EvaluationTestSetPublic[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void listEvaluationTestSets().then(setTestSets).catch(() => {});
  }, []);

  useEffect(() => {
    void Promise.all([listEvaluationNodeTypes(), listEvaluationMetrics()])
      .then(([c, m]) => {
        setCatalog(c);
        setMetrics(m);
      })
      .catch(() => {})
      .finally(() => setWfMetaLoading(false));
  }, []);

  const initialWorkflowForCanvas = useMemo(() => {
    const p = parseEvaluationWorkflowJson(workflowJson);
    return p.ok ? p.value : EMPTY_EVALUATION_WORKFLOW;
  }, [workflowJson, canvasKey]);

  const setWorkflowMode = (next: "canvas" | "json") => {
    if (next === workflowEditMode) return;
    if (workflowEditMode === "canvas" && next === "json") {
      const w = canvasRef.current?.getWorkflow();
      if (w) setWorkflowJson(JSON.stringify(w, null, 2));
    }
    if (workflowEditMode === "json" && next === "canvas") {
      const p = parseEvaluationWorkflowJson(workflowJson);
      if (!p.ok) {
        setError(p.error);
        return;
      }
      setError(null);
      setCanvasKey((k) => k + 1);
    }
    setWorkflowEditMode(next);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const periods = parsePeriodsCsv(periodsCsv);
    if (periods.length === 0) {
      setError("请填写至少一个 forward_return_periods");
      return;
    }
    let workflow: unknown;
    if (workflowEditMode === "canvas") {
      workflow = canvasRef.current?.getWorkflow() ?? EMPTY_EVALUATION_WORKFLOW;
    } else {
      const p = parseEvaluationWorkflowJson(workflowJson);
      if (!p.ok) {
        setError(p.error);
        return;
      }
      workflow = p.value;
    }
    const ml = Number(maxLoss);
    if (Number.isNaN(ml)) {
      setError("max_loss 须为数字");
      return;
    }
    const qRaw = quantiles.trim();
    const q = qRaw === "" ? null : Number(qRaw);
    if (qRaw !== "" && (Number.isNaN(q) || q === null || q < 2)) {
      setError("quantiles 须为空或 >= 2 的整数");
      return;
    }

    setSubmitting(true);
    try {
      const created = await createEvaluationProfile({
        name: name.trim(),
        description: description.trim(),
        test_set_id: testSetId === "__none__" ? null : testSetId,
        is_default: isDefault,
        prepare: {
          forward_return_periods: periods,
          quantiles: q,
          long_short: longShort,
          max_loss: ml,
        },
        workflow,
      });
      router.push(`/evaluation-profiles/${encodeURIComponent(created.id)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FactorFormPageContainer>
      <FactorFormPageHeader title="新增评价方案" />
      <form className="flex flex-col gap-6" onSubmit={(e) => void onSubmit(e)}>
        {error && (
          <Alert variant="destructive">
            <AlertTitle>无法保存</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="ep-name">名称</Label>
            <Input
              id="ep-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="默认 IC 方案"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="ep-desc">描述</Label>
            <Textarea
              id="ep-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label>默认测试集（可选）</Label>
            <Select
              modal={false}
              value={testSetId}
              onValueChange={(v) => {
                if (v != null) setTestSetId(v);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">无</SelectItem>
                {testSets.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 pt-8">
            <Switch
              id="ep-def"
              checked={isDefault}
              onCheckedChange={(v) => setIsDefault(Boolean(v))}
            />
            <Label htmlFor="ep-def" className="font-normal">
              设为默认方案
            </Label>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ep-periods">持有期 periods（逗号分隔）</Label>
            <Input
              id="ep-periods"
              className="font-mono text-sm"
              value={periodsCsv}
              onChange={(e) => setPeriodsCsv(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ep-q">分位数 quantiles（空=用测试集）</Label>
            <Input
              id="ep-q"
              className="font-mono text-sm"
              value={quantiles}
              onChange={(e) => setQuantiles(e.target.value)}
              placeholder="留空"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ep-ml">max_loss</Label>
            <Input
              id="ep-ml"
              className="font-mono text-sm"
              value={maxLoss}
              onChange={(e) => setMaxLoss(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 pt-8">
            <Switch
              id="ep-ls"
              checked={longShort}
              onCheckedChange={(v) => setLongShort(Boolean(v))}
            />
            <Label htmlFor="ep-ls" className="font-normal">
              long_short
            </Label>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Label className="shrink-0">工作流</Label>
            <div className="flex gap-1">
              <Button
                type="button"
                variant={workflowEditMode === "canvas" ? "default" : "outline"}
                size="sm"
                disabled={wfMetaLoading}
                onClick={() => setWorkflowMode("canvas")}
              >
                画布
              </Button>
              <Button
                type="button"
                variant={workflowEditMode === "json" ? "default" : "outline"}
                size="sm"
                onClick={() => setWorkflowMode("json")}
              >
                JSON
              </Button>
            </div>
          </div>
          {wfMetaLoading ? (
            <p className="text-sm text-muted-foreground">
              加载节点类型与指标列表…
            </p>
          ) : workflowEditMode === "canvas" ? (
            <EvaluationWorkflowCanvas
              key={canvasKey}
              ref={canvasRef}
              catalog={catalog}
              metrics={metrics}
              initialWorkflow={initialWorkflowForCanvas}
            />
          ) : (
            <>
              <Label htmlFor="ep-wf" className="sr-only">
                工作流 JSON
              </Label>
              <Textarea
                id="ep-wf"
                className="min-h-[12rem] font-mono text-xs"
                value={workflowJson}
                onChange={(e) => setWorkflowJson(e.target.value)}
                spellCheck={false}
              />
            </>
          )}
        </div>

        <div className="flex gap-2">
          <Button type="submit" disabled={submitting || !name.trim()}>
            {submitting ? "创建中…" : "创建"}
          </Button>
          <Link
            href="/evaluation-profiles"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            取消
          </Link>
        </div>
      </form>
    </FactorFormPageContainer>
  );
}
