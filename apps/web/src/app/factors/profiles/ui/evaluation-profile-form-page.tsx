"use client";

import { useCallback, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { PageFormHeaderActions } from "@/components/page-form-header-actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useEffectMicrotask } from "@/hooks/use-effect-microtask";
import {
  createEvaluationProfile,
  getEvaluationProfile,
  getEvaluationWorkflowTemplate,
  patchEvaluationProfile,
} from "@/lib/quant-agent-api";

import { FactorEditPageDescription } from "@/features/factors/ui/factor-edit-page-description";
import { FactorEditPageTitle } from "@/features/factors/ui/factor-edit-page-title";
import { Page } from "@/components/page";
import { ProfileWorkflowEditorBlock } from "./profile-editor-main-section";
import { EVALUATION_WORKFLOW_TEMPLATE_LOADING_TEXT } from "./profile-form-shared";
import { WorkflowGraphPersisted } from "@/components/workflow-graph/reactflow/types";
import {
  EMPTY_WORKFLOW,
  parsePersistedWorkflowGraphPayload,
} from "@/components/workflow-graph/reactflow/serialize";
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

  const [templateLoading, setTemplateLoading] = useState(!isEdit);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [workflow, setWorkflow] = useState<WorkflowGraphPersisted>(EMPTY_WORKFLOW);
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

  useEffectMicrotask(() => {
    if (isEdit) return;
    setTemplateLoading(true);
    void getEvaluationWorkflowTemplate()
      .then((tpl) => {
        setWorkflow(parsePersistedWorkflowGraphPayload(tpl));
        setCanvasKey((k) => k + 1);
      })
      .catch(() => {
        setWorkflow(EMPTY_WORKFLOW);
      })
      .finally(() => setTemplateLoading(false));
  }, [isEdit]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

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
      <Page>
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      </Page>
    );
  }

  if (loading) {
    return (
      <Page title={isEdit ? "编辑评价方案" : "新增评价方案"}>
        <p className="text-sm text-muted-foreground">加载中…</p>
      </Page>
    );
  }

  if (templateLoading) {
    return (
      <Page title="新增评价方案">
        <p className="text-sm text-muted-foreground">
          {EVALUATION_WORKFLOW_TEMPLATE_LOADING_TEXT}
        </p>
      </Page>
    );
  }

  return (
    <Page
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
      className={"max-w-full flex-1 min-h-0 h-full overflow-hidden"}
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
    </Page>
  );
}
