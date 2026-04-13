"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { FactorEditPageDescription } from "@/app/factors/ui/factor-edit-page-description";
import { FactorEditPageTitle } from "@/app/factors/ui/factor-edit-page-title";
import { createEvaluationMetric, getEvaluationMetricTemplate } from "@/api";
import { PageFormHeaderActions } from "@/components/page-form-header-actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CodeJar } from "@/components/ui/code-jar";
import { Label } from "@/components/ui/label";
import { defaultNewName } from "@/lib/default-new-name";

const NODE_NEW_FORM_ID = "node-new-form";

function NodeSourceEditor({
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
    const escaped = label.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

    return src.replace(
      /(@workflow_node\([\s\S]*?\blabel=")([^"]*)(")/,
      (_: string, prefix: string, _oldLabel: string, suffix: string) => {
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
    <CodeJar
      id="new-node-source"
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

export default function NewNodePage() {
  const router = useRouter();
  const [name, setName] = useState(() => defaultNewName("新节点"));
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
          setTemplateError(e instanceof Error ? e.message : "无法加载节点源码模板");
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
        ...(sourceRef.current.trim() ? { source: sourceRef.current.trim() } : {}),
      });
      router.push(`/nodes/${encodeURIComponent(created.id)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <CardHeader className="shrink-0 space-y-4 border-b pb-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <CardTitle>
              <FactorEditPageTitle
                name={name}
                onNameChange={setName}
                nameAriaLabel="节点名称"
              />
            </CardTitle>
            <CardDescription className="max-w-2xl">
              <FactorEditPageDescription
                description={description}
                onDescriptionChange={setDescription}
                descriptionAriaLabel="节点描述"
              />
            </CardDescription>
          </div>
          <PageFormHeaderActions
            formId={NODE_NEW_FORM_ID}
            submitting={submitting}
            submitDisabled={!name.trim() || templateLoading || template == null}
            submitLabel="创建"
            submittingLabel="创建中…"
            cancelHref="/nodes"
          />
        </div>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 overflow-y-auto">
        <form
          id={NODE_NEW_FORM_ID}
          className="flex flex-col gap-6 py-2"
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
              <div className="text-sm text-muted-foreground">正在加载源码模板…</div>
            )}
            {template != null && (
              <NodeSourceEditor template={template} sourceRef={sourceRef} name={name} />
            )}
          </div>
        </form>
      </CardContent>
    </>
  );
}
