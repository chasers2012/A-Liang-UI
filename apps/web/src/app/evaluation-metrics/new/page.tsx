"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { PageFormHeaderActions } from "@/components/page-form-header-actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createEvaluationMetric } from "@/lib/quant-agent-api";

import { FactorCodeJar } from "@/app/factors/ui/factor-code-jar";
import { FactorFormPageContainer } from "@/app/factors/ui/factor-form-page";

const EVALUATION_METRIC_NEW_FORM_ID = "evaluation-metric-new-form";

export default function NewEvaluationMetricPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [source, setSource] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const created = await createEvaluationMetric({
        name: name.trim(),
        description: description.trim(),
        ...(source.trim() ? { source: source.trim() } : {}),
      });
      router.push(`/evaluation-metrics/${encodeURIComponent(created.id)}`);
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
          cancelHref="/evaluation-metrics"
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
            <Label htmlFor="em-name">名称（Python 标识符）</Label>
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
          <Label>源码（可选，留空使用模板）</Label>
          <FactorCodeJar
            id="new-evaluation-metric-source"
            value={source}
            onChange={setSource}
          />
        </div>
      </form>
    </FactorFormPageContainer>
  );
}
