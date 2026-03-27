"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useParams, useRouter } from "next/navigation";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { useEffectMicrotask } from "@/hooks/use-effect-microtask";
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
  getEvaluationProfile,
  listEvaluationNodeTypes,
  listEvaluationTestSets,
  patchEvaluationProfile,
  type EvaluationTestSetPublic,
  type NodeTypeDefinitionPublic,
} from "@/lib/quant-agent-api";
import type { EvaluationWorkflowCanvasHandle } from "../../ui/evaluation-workflow-canvas";
import {
  ProfileEditorMainSectionSwitch,
  ProfilePrepareFieldsGridCompact,
  ProfileWorkflowEditorBlock,
} from "../../ui/profile-editor-main-section";

import {
  FactorFormPageContainer,
  FactorFormPageHeader,
} from "@/app/factors/ui/factor-form-page";
import {
  EMPTY_EVALUATION_WORKFLOW,
  parseEvaluationWorkflowJson,
  parseMaxLoss,
  parsePeriodsCsv,
  parseQuantilesInput,
} from "../../ui/profile-form-shared";

export default function EditEvaluationProfilePage() {
  const params = useParams<{ id: string }>();
  const raw = params.id;
  const id = Array.isArray(raw) ? raw[0] ?? "" : raw ?? "";
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [testSetId, setTestSetId] = useState<string>("__none__");
  const [isDefault, setIsDefault] = useState(false);
  const [periodsCsv, setPeriodsCsv] = useState("1,5,10,20");
  const [quantiles, setQuantiles] = useState("");
  const [longShort, setLongShort] = useState(true);
  const [maxLoss, setMaxLoss] = useState("0.5");
  const [workflowJson, setWorkflowJson] = useState("{}");
  const [mainSection, setMainSection] = useState<"workflow" | "prepare">(
    "workflow",
  );
  const [workflowEditMode, setWorkflowEditMode] = useState<"canvas" | "json">(
    "canvas",
  );
  const [canvasKey, setCanvasKey] = useState(0);
  const canvasRef = useRef<EvaluationWorkflowCanvasHandle>(null);
  const [catalog, setCatalog] = useState<NodeTypeDefinitionPublic[]>([]);
  const [testSets, setTestSets] = useState<EvaluationTestSetPublic[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void listEvaluationTestSets().then(setTestSets).catch(() => { });
  }, []);

  const load = useCallback(async () => {
    if (!id) return;
    setLoadError(null);
    setLoading(true);
    try {
      const [d, nodeTypes] = await Promise.all([
        getEvaluationProfile(id),
        listEvaluationNodeTypes(),
      ]);
      setCatalog(nodeTypes);
      setName(d.name);
      setDescription(d.description);
      setTestSetId(d.test_set_id ?? "__none__");
      setIsDefault(d.is_default);
      setPeriodsCsv(d.prepare.forward_return_periods.join(","));
      setQuantiles(
        d.prepare.quantiles != null ? String(d.prepare.quantiles) : "",
      );
      setLongShort(d.prepare.long_short);
      setMaxLoss(String(d.prepare.max_loss));
      setWorkflowJson(JSON.stringify(d.workflow, null, 2));
      setCanvasKey((k) => k + 1);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffectMicrotask(() => load(), [load]);

  const initialWorkflowForCanvas = useMemo(() => {
    try {
      return parseEvaluationWorkflowJson(workflowJson);
    } catch {
      return EMPTY_EVALUATION_WORKFLOW;
    }
  }, [workflowJson]);

  const setWorkflowMode = (next: "canvas" | "json") => {
    if (next === workflowEditMode) return;
    if (workflowEditMode === "canvas" && next === "json") {
      const w = canvasRef.current?.getWorkflow();
      if (w) setWorkflowJson(JSON.stringify(w, null, 2));
    }
    if (workflowEditMode === "json" && next === "canvas") {
      try {
        parseEvaluationWorkflowJson(workflowJson);
      } catch (e) {
        setFormError(e instanceof Error ? e.message : String(e));
        return;
      }
      setFormError(null);
      setCanvasKey((k) => k + 1);
    }
    setWorkflowEditMode(next);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setFormError(null);
    const periods = parsePeriodsCsv(periodsCsv);
    if (periods.length === 0) {
      setFormError("请填写至少一个 forward_return_periods");
      return;
    }

    setSubmitting(true);
    try {
      const workflow =
        workflowEditMode === "canvas"
          ? canvasRef.current?.getWorkflow() ?? EMPTY_EVALUATION_WORKFLOW
          : parseEvaluationWorkflowJson(workflowJson);
      const ml = parseMaxLoss(maxLoss);
      const q = parseQuantilesInput(quantiles);
      await patchEvaluationProfile(id, {
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
      router.push(`/evaluation-profiles/${encodeURIComponent(id)}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (!id) {
    return (
      <FactorFormPageContainer>
        <Alert variant="destructive">
          <AlertTitle>无效 id</AlertTitle>
        </Alert>
      </FactorFormPageContainer>
    );
  }

  if (loadError) {
    return (
      <FactorFormPageContainer>
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      </FactorFormPageContainer>
    );
  }

  if (loading) {
    return (
      <FactorFormPageContainer>
        <p className="text-sm text-muted-foreground">加载中…</p>
      </FactorFormPageContainer>
    );
  }

  return (
    <FactorFormPageContainer>
      <FactorFormPageHeader title="编辑评价方案" />
      <form className="flex flex-col gap-6" onSubmit={(e) => void onSubmit(e)}>
        {formError && (
          <Alert variant="destructive">
            <AlertTitle>无法保存</AlertTitle>
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="ep-e-name">名称</Label>
            <Input
              id="ep-e-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="ep-e-desc">描述</Label>
            <Textarea
              id="ep-e-desc"
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
              id="ep-e-def"
              checked={isDefault}
              onCheckedChange={(v) => setIsDefault(Boolean(v))}
            />
            <Label htmlFor="ep-e-def" className="font-normal">
              设为默认方案
            </Label>
          </div>
        </div>

        <ProfileEditorMainSectionSwitch
          mainSection={mainSection}
          onMainSection={setMainSection}
        />

        {mainSection === "prepare" ? (
          <ProfilePrepareFieldsGridCompact
            ids={{
              periods: "ep-e-periods",
              quantiles: "ep-e-q",
              maxLoss: "ep-e-ml",
              longShort: "ep-e-ls",
            }}
            periodsCsv={periodsCsv}
            onPeriodsCsv={setPeriodsCsv}
            quantiles={quantiles}
            onQuantiles={setQuantiles}
            maxLoss={maxLoss}
            onMaxLoss={setMaxLoss}
            longShort={longShort}
            onLongShort={setLongShort}
          />
        ) : (
          <ProfileWorkflowEditorBlock
            workflowJson={workflowJson}
            onWorkflowJson={setWorkflowJson}
            workflowJsonFieldId="ep-e-wf"
            workflowEditMode={workflowEditMode}
            onWorkflowMode={setWorkflowMode}
            canvasKey={canvasKey}
            canvasRef={canvasRef}
            catalog={catalog}
            initialWorkflow={initialWorkflowForCanvas}
          />
        )}

        <div className="flex gap-2">
          <Button type="submit" disabled={submitting || !name.trim()}>
            {submitting ? "保存中…" : "保存"}
          </Button>
          <Link
            href={`/evaluation-profiles/${encodeURIComponent(id)}`}
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            取消
          </Link>
        </div>
      </form>
    </FactorFormPageContainer>
  );
}
