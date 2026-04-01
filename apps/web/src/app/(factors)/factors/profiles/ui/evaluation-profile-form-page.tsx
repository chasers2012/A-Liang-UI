"use client";

import { useCallback, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { PageFormHeaderActions } from "@/components/page-form-header-actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useEffectMicrotask } from "@/hooks/use-effect-microtask";
import { createEvaluationProfile, getEvaluationProfile, patchEvaluationProfile } from "@/lib/quant-agent-api";

import { FactorFormPageContainer } from "@/features/factors/ui/factor-form-page";
import type { EvaluationWorkflowCanvasHandle } from "./evaluation-workflow-canvas";
import { ProfileWorkflowEditorBlock } from "./profile-editor-main-section";
import {
  DEFAULT_WORKFLOW_JSON,
  EMPTY_EVALUATION_WORKFLOW,
  parseEvaluationWorkflowJson,
} from "./profile-form-shared";

type Props = {
  id?: string;
};

export function EvaluationProfileFormPage(props: Props) {
  const router = useRouter();

  const id = props.id ?? null;
  const isEdit = Boolean(id);

  const formId = isEdit ? "evaluation-profile-edit-form" : "evaluation-profile-new-form";
  const title = isEdit ? "编辑评价方案" : "新增评价方案";
  const cancelHref = isEdit
    ? `/factors/profiles/${encodeURIComponent(id ?? "")}`
    : "/factors/profiles";

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [workflowJson, setWorkflowJson] = useState(isEdit ? "{}" : DEFAULT_WORKFLOW_JSON);
  const [workflowEditMode, setWorkflowEditMode] = useState<"canvas" | "json">("canvas");
  const [canvasKey, setCanvasKey] = useState(0);
  const canvasRef = useRef<EvaluationWorkflowCanvasHandle>(null);

  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(isEdit);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!isEdit) return;
    if (!id) return;

    setLoadError(null);
    setLoading(true);
    try {
      const d = await getEvaluationProfile(id);
      setName(d.name);
      setDescription(d.description);
      setIsDefault(d.is_default);
      try {
        const w = d.workflow;
        setWorkflowJson(
          typeof w === "string"
            ? JSON.stringify(JSON.parse(w), null, 2)
            : JSON.stringify(w, null, 2),
        );
      } catch {
        setWorkflowJson(typeof d.workflow === "string" ? d.workflow : "{}");
      }
      setCanvasKey((k) => k + 1);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [id, isEdit]);

  useEffectMicrotask(() => void load(), [load]);

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
      if (w) {
        try {
          setWorkflowJson(JSON.stringify(JSON.parse(w), null, 2));
        } catch {
          setWorkflowJson(w);
        }
      }
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
    setFormError(null);

    let workflow: string;
    try {
      workflow =
        workflowEditMode === "canvas"
          ? canvasRef.current?.getWorkflow() ?? EMPTY_EVALUATION_WORKFLOW
          : parseEvaluationWorkflowJson(workflowJson);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
      return;
    }

    setSubmitting(true);
    try {
      if (isEdit) {
        if (!id) throw new Error("无效 id");
        await patchEvaluationProfile(id, {
          name: name.trim(),
          description: description.trim(),
          is_default: isDefault,
          workflow,
        });
        router.push(`/factors/profiles/${encodeURIComponent(id)}`);
      } else {
        const created = await createEvaluationProfile({
          name: name.trim(),
          description: description.trim(),
          is_default: isDefault,
          workflow,
        });
        router.push(`/factors/profiles/${encodeURIComponent(created.id)}`);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };


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
    <FactorFormPageContainer
      title={title}
      action={
        <PageFormHeaderActions
          formId={formId}
          submitting={submitting}
          submitDisabled={!name.trim()}
          submitLabel={isEdit ? undefined : "创建"}
          submittingLabel={isEdit ? undefined : "创建中…"}
          cancelHref={cancelHref}
        />
      }
    >
      <form id={formId} className="flex flex-col gap-6" onSubmit={(e) => void onSubmit(e)}>
        {formError && (
          <Alert variant="destructive">
            <AlertTitle>无法保存</AlertTitle>
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="ep-name">名称</Label>
            <Input
              id="ep-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={isEdit ? undefined : "默认 IC 方案"}
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
        </div>


        <ProfileWorkflowEditorBlock
          workflowJson={workflowJson}
          onWorkflowJson={setWorkflowJson}
          workflowJsonFieldId={isEdit ? "ep-e-wf" : "ep-wf"}
          workflowEditMode={workflowEditMode}
          onWorkflowMode={setWorkflowMode}
          canvasKey={canvasKey}
          canvasRef={canvasRef}
          initialWorkflow={initialWorkflowForCanvas}
        />
      </form>
    </FactorFormPageContainer>
  );
}

