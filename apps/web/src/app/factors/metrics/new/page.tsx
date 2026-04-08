"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { PageFormHeaderActions } from "@/components/page-form-header-actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { createEvaluationMetric, getEvaluationMetricTemplate } from "@/lib/quant-agent-api";

import { FactorEditPageDescription } from "@/features/factors/ui/factor-edit-page-description";
import { FactorEditPageTitle } from "@/features/factors/ui/factor-edit-page-title";
import { FactorCodeJar } from "@/features/factors/ui/factor-code-jar";
import { Page } from "@/components/page";

const EVALUATION_METRIC_NEW_FORM_ID = "evaluation-metric-new-form";

function EvaluationMetricSourceEditor({
  template,
  sourceRef,
  name,
}: {
  template: string;
  sourceRef: React.MutableRefObject<string>;
  name: string;
}) {
  const [source, setSource] = useState(template);

  useEffect(() => {
    setSource(template);
  }, [template]);

  const trimmedName = name.trim();
  const applyNameToWorkflowNodeLabel = (src: string, label: string) => {
    const escaped = label
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"');

    // Template format: @workflow_node( ... label="...",
    // Only replace the label value inside the workflow_node decorator.
    return src.replace(
      /(@workflow_node\([\s\S]*?\blabel=")([^"]*)(")/,
      (_, prefix: string, _oldLabel: string, suffix: string) => {
        return `${prefix}${escaped}${suffix}`;
      },
    );
  };

  const displaySource = useMemo(() => {
    if (!trimmedName) return source;
    return applyNameToWorkflowNodeLabel(source, trimmedName);
  }, [source, trimmedName]);

  useEffect(() => {
    sourceRef.current = displaySource;
  }, [displaySource, sourceRef]);

  return (
    <FactorCodeJar
      id="new-evaluation-metric-source"
      value={displaySource}
      onChange={(v) => {
        setSource(v);
        if (trimmedName) {
          sourceRef.current = applyNameToWorkflowNodeLabel(v, trimmedName);
        } else {
          sourceRef.current = v;
        }
      }}
    />
  );
}

export default function NewEvaluationMetricPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const sourceRef = useRef("");
  const [template, setTemplate] = useState<string | null>(null);
  const [templateLoading, setTemplateLoading] = useState(true);
  const [templateError, setTemplateError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const t = await getEvaluationMetricTemplate();
        if (!cancelled) setTemplate(t);
      } catch (e) {
        if (!cancelled) {
          setTemplateError(
            e instanceof Error ? e.message : "无法加载评价指标源码模板",
          );
        }
      } finally {
        if (!cancelled) setTemplateLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const created = await createEvaluationMetric({
        name: name.trim(),
        description: description.trim(),
        ...(sourceRef.current.trim()
          ? { source: sourceRef.current.trim() }
          : {}),
      });
      router.push(`/factors/metrics/${encodeURIComponent(created.id)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Page
      title={
        <FactorEditPageTitle
          name={name}
          onNameChange={setName}
          nameAriaLabel="评价指标名称"
        />
      }
      description={
        <FactorEditPageDescription
          description={description}
          onDescriptionChange={setDescription}
          descriptionAriaLabel="评价指标描述"
        />
      }
      action={
        <PageFormHeaderActions
          formId={EVALUATION_METRIC_NEW_FORM_ID}
          submitting={submitting}
          submitDisabled={!name.trim() || templateLoading || template == null}
          submitLabel="创建"
          submittingLabel="创建中…"
          cancelHref="/factors/metrics"
        />
      }
    >
      <form
        id={EVALUATION_METRIC_NEW_FORM_ID}
        className="flex flex-col gap-6"
        onSubmit={(e) => void onSubmit(e)}
      >
        {templateError && (
          <Alert variant="destructive">
            <AlertTitle>无法加载模板</AlertTitle>
            <AlertDescription>{templateError}</AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertTitle>无法保存</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="space-y-2">
          <Label>源码</Label>
          {templateLoading && (
            <div className="text-sm text-muted-foreground">
              正在加载源码模板…
            </div>
          )}
          {template != null && (
            <EvaluationMetricSourceEditor
              template={template}
              sourceRef={sourceRef}
              name={name}
            />
          )}
        </div>
      </form>
    </Page>
  );
}
