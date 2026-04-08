"use client";

import { useCallback, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { PageFormHeaderActions } from "@/components/page-form-header-actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useEffectMicrotask } from "@/hooks/use-effect-microtask";
import { createEvaluationProfile, getEvaluationProfile, patchEvaluationProfile } from "@/lib/quant-agent-api";

import { FactorEditPageDescription } from "@/features/factors/ui/factor-edit-page-description";
import { FactorEditPageTitle } from "@/features/factors/ui/factor-edit-page-title";
import { FactorFormPageContainer } from "@/features/factors/ui/factor-form-page";
import { ProfileWorkflowEditorBlock } from "./profile-editor-main-section";
import { EMPTY_EVALUATION_WORKFLOW } from "./profile-form-shared";
import { WorkflowGraphPersisted } from "@/components/workflow-graph/reactflow/types";
import type { WorkflowGraphCanvasHandle } from "@/components/workflow-graph";

type Props = {
  id?: string;
};

export function EvaluationProfileFormPage(props: Props) {
  const router = useRouter();

  const id = props.id ?? null;
  const isEdit = Boolean(id);

  const formId = isEdit ? "evaluation-profile-edit-form" : "evaluation-profile-new-form";
  const cancelHref = isEdit
    ? `/factors/profiles/${encodeURIComponent(id ?? "")}`
    : "/factors/profiles";

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [workflow, setWorkflow] = useState<WorkflowGraphPersisted>(EMPTY_EVALUATION_WORKFLOW);
  const [canvasKey, setCanvasKey] = useState(0);
  const canvasRef = useRef<WorkflowGraphCanvasHandle>(null);

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
      setWorkflow(d.workflow);
      setCanvasKey((k) => k + 1);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [id, isEdit]);

  useEffectMicrotask(() => void load(), [load]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // 保存前先调整 viewport，使所有节点可见，并把调整后的 viewport 一起持久化。
    await canvasRef.current?.fitViewAll();
    const wf = canvasRef.current?.getGraph() ?? workflow;

    setSubmitting(true);
    try {
      if (isEdit) {
        if (!id) throw new Error("无效 id");
        await patchEvaluationProfile(id, {
          name: name.trim(),
          description: description.trim(),
          workflow: wf,
        });
        router.push(`/factors/profiles/${encodeURIComponent(id)}`);
      } else {
        const created = await createEvaluationProfile({
          name: name.trim(),
          description: description.trim(),
          workflow: wf,
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
      <FactorFormPageContainer title={isEdit ? "编辑评价方案" : "新增评价方案"}>
        <p className="text-sm text-muted-foreground">加载中…</p>
      </FactorFormPageContainer>
    );
  }

  return (
    <FactorFormPageContainer
      title={
        <FactorEditPageTitle
          name={name}
          onNameChange={setName}
          nameAriaLabel="评价方案名称"
        />
      }
      description={
        <FactorEditPageDescription
          description={description}
          onDescriptionChange={setDescription}
          descriptionAriaLabel="评价方案描述"
        />
      }
      className="max-w-full"
      fillHeight
      gap="sm"
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
      <form
        id={formId}
        className="flex min-h-0 flex-1 flex-col gap-6"
        onSubmit={(e) => void onSubmit(e)}
      >
        {formError && (
          <Alert variant="destructive" className="shrink-0">
            <AlertTitle>无法保存</AlertTitle>
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        <ProfileWorkflowEditorBlock
          workflow={workflow}
          canvasKey={canvasKey}
          canvasRef={canvasRef}
        />
      </form>
    </FactorFormPageContainer>
  );
}
