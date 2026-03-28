"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";

import { PageFormHeaderActions } from "@/components/page-form-header-actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  listEvaluationNodeTypes,
  listEvaluationTestSets,
  type EvaluationTestSetPublic,
  type NodeTypeDefinitionPublic,
} from "@/lib/quant-agent-api";
import type { EvaluationWorkflowCanvasHandle } from "../ui/evaluation-workflow-canvas";
import { ProfileWorkflowEditorBlock } from "../ui/profile-editor-main-section";

import { FactorFormPageContainer } from "@/features/factors/ui/factor-form-page";
import {
  DEFAULT_WORKFLOW_JSON,
  EMPTY_EVALUATION_WORKFLOW,
  parseEvaluationWorkflowJson,
} from "../ui/profile-form-shared";

const EVALUATION_PROFILE_NEW_FORM_ID = "evaluation-profile-new-form";

export default function NewEvaluationProfilePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [testSetId, setTestSetId] = useState<string>("__none__");
  const [isDefault, setIsDefault] = useState(false);
  const [workflowJson, setWorkflowJson] = useState(DEFAULT_WORKFLOW_JSON);
  const [workflowEditMode, setWorkflowEditMode] = useState<"canvas" | "json">(
    "canvas",
  );
  const [canvasKey, setCanvasKey] = useState(0);
  const canvasRef = useRef<EvaluationWorkflowCanvasHandle>(null);
  const [catalog, setCatalog] = useState<NodeTypeDefinitionPublic[]>([]);
  const [wfMetaLoading, setWfMetaLoading] = useState(true);
  const [testSets, setTestSets] = useState<EvaluationTestSetPublic[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void listEvaluationTestSets().then(setTestSets).catch(() => { });
  }, []);

  useEffect(() => {
    void listEvaluationNodeTypes()
      .then((c) => {
        setCatalog(c);
      })
      .catch(() => { })
      .finally(() => setWfMetaLoading(false));
  }, []);

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
        setError(e instanceof Error ? e.message : String(e));
        return;
      }
      setError(null);
      setCanvasKey((k) => k + 1);
    }
    setWorkflowEditMode(next);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    let workflow: unknown;
    try {
      workflow =
        workflowEditMode === "canvas"
          ? canvasRef.current?.getWorkflow() ?? EMPTY_EVALUATION_WORKFLOW
          : parseEvaluationWorkflowJson(workflowJson);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return;
    }

    setSubmitting(true);
    try {
      const created = await createEvaluationProfile({
        name: name.trim(),
        description: description.trim(),
        test_set_id: testSetId === "__none__" ? null : testSetId,
        is_default: isDefault,
        workflow,
      });
      router.push(`/factors/profiles/${encodeURIComponent(created.id)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FactorFormPageContainer
      title="新增评价方案"
      action={
        <PageFormHeaderActions
          formId={EVALUATION_PROFILE_NEW_FORM_ID}
          submitting={submitting}
          submitDisabled={!name.trim()}
          submitLabel="创建"
          submittingLabel="创建中…"
          cancelHref="/factors/profiles"
        />
      }
    >
      <form
        id={EVALUATION_PROFILE_NEW_FORM_ID}
        className="flex flex-col gap-6"
        onSubmit={(e) => void onSubmit(e)}
      >
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

        <p className="text-xs text-muted-foreground">
          持有期、分位数、max_loss、long_short 等请在画布上选中「计算因子」节点，在右侧节点参数中编辑。
        </p>
        <ProfileWorkflowEditorBlock
          workflowJson={workflowJson}
          onWorkflowJson={setWorkflowJson}
          workflowJsonFieldId="ep-wf"
          workflowEditMode={workflowEditMode}
          onWorkflowMode={setWorkflowMode}
          wfMetaLoading={wfMetaLoading}
          canvasKey={canvasKey}
          canvasRef={canvasRef}
          catalog={catalog}
          initialWorkflow={initialWorkflowForCanvas}
        />

      </form>
    </FactorFormPageContainer>
  );
}
