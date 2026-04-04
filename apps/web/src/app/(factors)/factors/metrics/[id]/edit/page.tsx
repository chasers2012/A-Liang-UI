"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { PageFormHeaderActions } from "@/components/page-form-header-actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getEvaluationMetric, patchEvaluationMetric } from "@/lib/quant-agent-api";
import type { NodeParamModel } from "@/models/evaluation-metric/dto";

import { FactorCodeJar } from "@/features/factors/ui/factor-code-jar";
import { FactorFormPageContainer } from "@/features/factors/ui/factor-form-page";

const EVALUATION_METRIC_EDIT_FORM_ID = "evaluation-metric-edit-form";

export default function EditEvaluationMetricPage() {
  const params = useParams<{ id: string }>();
  const raw = params.id;
  const id = Array.isArray(raw) ? raw[0] ?? "" : raw ?? "";
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [source, setSource] = useState("");
  const [workflowParams, setWorkflowParams] = useState<
    NodeParamModel[]
  >([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoadError(null);
    setLoading(true);
    try {
      const d = await getEvaluationMetric(id);
      setName(d.name);
      setDescription(d.description);
      setSource(d.source);
      setWorkflowParams(
        Array.isArray(d.workflow_parameters) ? d.workflow_parameters : [],
      );
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setFormError(null);
    setSubmitting(true);
    try {
      const normalizedWp = workflowParams
        .filter((p) => p.key.trim())
        .map((p) => ({
          ...p,
          key: p.key.trim(),
          label: (p.label || "").trim() || p.key.trim(),
          minimum: p.type === "number" ? p.minimum : null,
          maximum: p.type === "number" ? p.maximum : null,
        }));
      await patchEvaluationMetric(id, {
        name: name.trim(),
        description: description.trim(),
        source: source.trim(),
        workflow_parameters: normalizedWp,
      });
      router.push(`/factors/metrics/${encodeURIComponent(id)}`);
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
    <FactorFormPageContainer
      title="编辑评价指标"
      action={
        <PageFormHeaderActions
          formId={EVALUATION_METRIC_EDIT_FORM_ID}
          submitting={submitting}
          submitDisabled={!name.trim()}
          cancelHref={`/factors/metrics/${encodeURIComponent(id)}`}
        />
      }
    >
      <form
        id={EVALUATION_METRIC_EDIT_FORM_ID}
        className="flex flex-col gap-6"
        onSubmit={(e) => void onSubmit(e)}
      >
        {formError && (
          <Alert variant="destructive">
            <AlertTitle>无法保存</AlertTitle>
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="em-edit-name">名称</Label>
            <Input
              id="em-edit-name"
              className="font-mono text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="em-edit-desc">描述</Label>
            <Textarea
              id="em-edit-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>源码</Label>
          <FactorCodeJar
            id="edit-evaluation-metric-source"
            value={source}
            onChange={setSource}
          />
        </div>
      </form>
    </FactorFormPageContainer>
  );
}
