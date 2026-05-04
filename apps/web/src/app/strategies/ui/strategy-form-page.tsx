'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAtomValue, useSetAtom } from 'jotai';

import { PageFormHeaderActions } from '@/components/page-form-header-actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

import { Page } from '@/components/page';
import { StrategyWorkflowEditorBlock } from './strategy-editor-main-section';
import type { WorkflowGraphCanvasHandle } from '@/components/workflow-graph';
import { EditablePageDescription } from '@/components/editable-page-description';
import { EditablePageTitle } from '@/components/editable-page-title';
import {
  initStrategyFormAtomFamily,
  setStrategyFormDescriptionAtomFamily,
  setStrategyFormNameAtomFamily,
  strategyFormStateAtomFamily,
  submitStrategyFormAtomFamily,
} from '@/models/strategy/form.atom';

type Props = { id?: string };

export function StrategyFormPage(props: Props) {
  const router = useRouter();

  const id = props.id ?? null;
  const isEdit = Boolean(id);
  const formId = isEdit ? 'strategy-edit-form' : 'strategy-new-form';
  const cancelHref = isEdit ? `/strategies?strategyId=${encodeURIComponent(id ?? '')}` : '/strategies';

  const [canvasKey, setCanvasKey] = useState(0);
  const canvasRef = useRef<WorkflowGraphCanvasHandle>(null);

  const key = id ?? '__new__';
  const state = useAtomValue(strategyFormStateAtomFamily(key));
  const init = useSetAtom(initStrategyFormAtomFamily(key));
  const setName = useSetAtom(setStrategyFormNameAtomFamily(key));
  const setDescription = useSetAtom(setStrategyFormDescriptionAtomFamily(key));
  const submit = useSetAtom(submitStrategyFormAtomFamily(key));

  useEffect(() => {
    void init(id).then(() => setCanvasKey((k) => k + 1));
  }, [id, init]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const wf = canvasRef.current?.getGraph() ?? state.workflow;
    const savedId = await submit({ id, workflow: wf });
    if (savedId) router.push(`/strategies?strategyId=${encodeURIComponent(savedId)}`);
  };

  const pageTitle = isEdit ? (
    <EditablePageTitle
      value={state.name}
      onChange={(name) => void setName(name)}
      inputAriaLabel="策略名称"
      editButtonAriaLabel="编辑名称"
    />
  ) : (
    '新增策略'
  );

  const pageDescription = isEdit ? (
    <EditablePageDescription
      value={state.description}
      onChange={(v) => void setDescription(v)}
      textareaAriaLabel="策略描述"
    />
  ) : (
    '创建一个新的策略工作流。'
  );

  if (state.loadError) {
    return (
      <Page>
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>{state.loadError}</AlertDescription>
        </Alert>
      </Page>
    );
  }

  if (state.loading) {
    return (
      <Page title={isEdit ? '编辑策略' : '新增策略'}>
        <p className="text-sm text-muted-foreground">加载中…</p>
      </Page>
    );
  }

  if (state.templateLoading) {
    return (
      <Page title="新增策略">
        <p className="text-sm text-muted-foreground">加载策略工作流模板…</p>
      </Page>
    );
  }

  return (
    <Page
      title={pageTitle}
      description={pageDescription}
      className="max-w-full h-full overflow-hidden"
      size="full"
      gap="sm"
      action={<PageFormHeaderActions formId={formId} submitting={state.submitting} cancelHref={cancelHref} />}
    >
      {state.formError && (
        <Alert variant="destructive" className="shrink-0">
          <AlertTitle>无法保存</AlertTitle>
          <AlertDescription>{state.formError}</AlertDescription>
        </Alert>
      )}
      <form
        id={formId}
        className="flex min-h-0 flex-1 flex-col gap-6 overflow-hidden"
        onSubmit={(e) => void onSubmit(e)}
      >
        <StrategyWorkflowEditorBlock workflow={state.workflow} canvasKey={canvasKey} canvasRef={canvasRef} />
      </form>
    </Page>
  );
}
