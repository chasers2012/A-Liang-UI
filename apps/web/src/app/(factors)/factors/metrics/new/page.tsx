"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { PageFormHeaderActions } from "@/components/page-form-header-actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createEvaluationMetric, getEvaluationMetricTemplate } from "@/lib/quant-agent-api";

import { FactorCodeJar } from "@/features/factors/ui/factor-code-jar";
import { FactorFormPageContainer } from "@/features/factors/ui/factor-form-page";

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
    <FactorFormPageContainer
      title="新增评价指标"
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
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="em-name">名称</Label>
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
        </div>
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
    </FactorFormPageContainer>
  );
}
