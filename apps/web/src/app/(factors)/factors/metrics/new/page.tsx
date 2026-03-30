"use client";

import { Suspense, use, useEffect, useMemo, useRef, useState } from "react";
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
  templatePromise,
  sourceRef,
  name,
}: {
  templatePromise: Promise<string>;
  sourceRef: React.MutableRefObject<string>;
  name: string;
}) {
  const template = use(templatePromise);
  const [source, setSource] = useState(template);

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

  const templatePromise = useMemo(
    () => getEvaluationMetricTemplate(),
    [],
  );

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
          submitDisabled={!name.trim()}
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
          <Suspense
            fallback={
              <div className="text-sm text-muted-foreground">
                正在加载源码模板…
              </div>
            }
          >
            <EvaluationMetricSourceEditor
              templatePromise={templatePromise}
              sourceRef={sourceRef}
              name={name}
            />
          </Suspense>
        </div>
      </form>
    </FactorFormPageContainer>
  );
}
