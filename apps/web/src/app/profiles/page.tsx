'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai';
import { Pencil, Plus } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import { PanelDetailCard } from '@/components/panel-detail-card';
import { Page } from '@/components/page';
import { cn } from '@/lib/utils';
import { CollapsibleSearchListSidebar } from '@/components/collapsible-search-list-sidebar';
import { SearchList } from '@/components/search-list';
import { useNavigationEditGuard } from '@/components/navigation-edit-guard-context';
import { EditablePageDescription } from '@/components/editable-page-description';
import { EditablePageTitle } from '@/components/editable-page-title';
import { ProfileDetailWorkflowCard } from './ui/profile-detail-workflow-card';
import { ProfileWorkflowEditorBlock } from './ui/profile-editor-main-section';
import { evaluationProfilesListAtoms } from '@/models/evaluation-profile/list-detail.atom';
import {
  evaluationProfileDetailAtomFamily,
  loadEvaluationProfileDetailAtomFamily,
} from '@/models/evaluation-profile/list-detail.atom';
import {
  createEvaluationProfile,
  getEvaluationProfile,
  getEvaluationWorkflowTemplate,
  patchEvaluationProfile,
} from '@/api/evaluation-profiles';
import { defaultNewName } from '@/lib/default-new-name';
import { useEffectMicrotask } from '@/hooks/use-effect-microtask';
import type { WorkflowGraphCanvasHandle } from '@/components/workflow-graph';
import { EMPTY_WORKFLOW, parsePersistedWorkflowGraphPayload } from '@/components/workflow-graph/reactflow/serialize';
import type { WorkflowGraphPersisted } from '@/components/workflow-graph/reactflow/types';

function getEmptyText(error: string | null, itemCount: number): string {
  if (error) return '评价方案列表加载失败。';
  if (itemCount === 0) return '暂无评价方案。请使用上方「新增方案」开始配置。';
  return '没有符合当前筛选条件的评价方案。';
}

const evaluationProfilesPanelIsEditingAtom = atom(false);

function EvaluationProfileDetailPanel(props: { selectedId: string | null; onEdit: (id: string) => void }) {
  const { selectedId, onEdit } = props;

  const { row, error } = useAtomValue(evaluationProfileDetailAtomFamily(selectedId ?? ''));
  const loadDetail = useSetAtom(loadEvaluationProfileDetailAtomFamily(selectedId ?? ''));

  useEffect(() => {
    if (!selectedId) return;
    void loadDetail();
  }, [loadDetail, selectedId]);

  const detailTitle = useMemo(() => {
    if (!selectedId) return '评价方案';
    if (row) return row.name;
    return '评价方案详情';
  }, [row, selectedId]);

  const metaContent = useMemo(() => {
    if (!selectedId) {
      return (
        <Alert>
          <AlertDescription>请选择左侧评价方案后查看详情。</AlertDescription>
        </Alert>
      );
    }
    if (error) {
      return (
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      );
    }
    if (!row) {
      return <p className="p-6 text-sm text-muted-foreground">加载中…</p>;
    }
    const desc = row.description?.trim() ? row.description : '无描述';
    return (
      <div className="rounded-md border bg-card p-4 text-sm leading-6 text-foreground whitespace-pre-wrap">{desc}</div>
    );
  }, [error, row, selectedId]);

  const workflowContent = useMemo(() => {
    if (!selectedId) {
      return (
        <Alert>
          <AlertDescription>请选择左侧评价方案后查看工作流。</AlertDescription>
        </Alert>
      );
    }
    if (error) {
      return (
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      );
    }
    if (!row) {
      return <p className="p-6 text-sm text-muted-foreground">加载中…</p>;
    }
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <ProfileDetailWorkflowCard profile={row} profileId={selectedId} />
      </div>
    );
  }, [error, row, selectedId]);

  return (
    <PanelDetailCard
      title={detailTitle}
      actions={
        selectedId ? (
          <button
            type="button"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1.5')}
            onClick={() => onEdit(selectedId)}
          >
            <Pencil className="size-4" aria-hidden />
            编辑
          </button>
        ) : null
      }
      panels={[
        {
          value: 'meta',
          label: '基础信息',
          content: <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">{metaContent}</div>,
          contentClassName: 'overflow-y-auto',
        },
        {
          value: 'workflow',
          label: '工作流',
          content: <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">{workflowContent}</div>,
          contentClassName: 'overflow-hidden',
        },
      ]}
    ></PanelDetailCard>
  );
}

function EvaluationProfileEditorPanel(props: {
  profileId: string | null;
  onCancel: () => void;
  onSaved: (saved: { id: string }) => void;
}) {
  const { profileId, onCancel, onSaved } = props;
  const isEdit = profileId != null;

  const [templateLoading, setTemplateLoading] = useState(!isEdit);
  const [name, setName] = useState(() => (isEdit ? '' : ''));
  const [description, setDescription] = useState('');
  const [workflow, setWorkflow] = useState<WorkflowGraphPersisted>(EMPTY_WORKFLOW);
  const [canvasKey, setCanvasKey] = useState(0);
  const canvasRef = useRef<WorkflowGraphCanvasHandle>(null);

  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(isEdit);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    if (!isEdit) return;
    if (!profileId) return;

    setLoadError(null);
    setLoading(true);
    try {
      const d = await getEvaluationProfile(profileId);
      setName(d.name);
      setDescription(d.description);
      setWorkflow(d.workflow);
      setCanvasKey((k) => k + 1);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffectMicrotask(() => void load(), [isEdit, profileId]);

  useEffectMicrotask(() => {
    if (isEdit) return;
    setName((n) => (n.trim() ? n : defaultNewName('新评价方案')));
  }, [isEdit]);

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
        if (!profileId) throw new Error('无效 id');
        const saved = await patchEvaluationProfile(profileId, {
          name: name.trim(),
          description: description.trim(),
          workflow: wf,
        });
        onSaved({ id: saved.id });
      } else {
        const created = await createEvaluationProfile({
          name: name.trim(),
          description: description.trim(),
          workflow: wf,
        });
        onSaved({ id: created.id });
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const formId = 'evaluation-profile-panel-edit-form';

  if (loadError) {
    return (
      <PanelDetailCard title={isEdit ? '编辑评价方案' : '新增评价方案'}>
        <div className="flex flex-col gap-4">
          <Alert variant="destructive">
            <AlertTitle>加载失败</AlertTitle>
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
          <button
            type="button"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
            onClick={() => void onCancel()}
          >
            取消
          </button>
        </div>
      </PanelDetailCard>
    );
  }

  if (loading) {
    return (
      <PanelDetailCard title={isEdit ? '编辑评价方案' : '新增评价方案'}>
        <p className="text-sm text-muted-foreground">加载中…</p>
      </PanelDetailCard>
    );
  }

  if (templateLoading) {
    return (
      <PanelDetailCard title="新增评价方案">
        <p className="text-sm text-muted-foreground">加载工作流模板…</p>
      </PanelDetailCard>
    );
  }

  return (
    <PanelDetailCard
      title={
        <EditablePageTitle
          value={name}
          showEdit
          onChange={setName}
          inputAriaLabel="评价方案名称"
          editButtonAriaLabel="编辑名称"
          placeholder={isEdit ? '编辑评价方案' : '新增评价方案'}
        />
      }
      actions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
            onClick={() => void onCancel()}
            disabled={submitting}
          >
            取消
          </button>
          <button
            type="submit"
            form={formId}
            className={cn(buttonVariants({ variant: 'default', size: 'sm' }))}
            disabled={submitting || !name.trim()}
          >
            {submitting ? (isEdit ? '保存中…' : '创建中…') : isEdit ? '保存' : '创建'}
          </button>
        </div>
      }
      panels={[
        {
          value: 'meta',
          label: '基础信息',
          content: (
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1">
              {formError ? (
                <Alert variant="destructive" className="shrink-0">
                  <AlertTitle>无法保存</AlertTitle>
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              ) : null}

              <div className="space-y-2">
                <EditablePageDescription
                  value={description}
                  onChange={setDescription}
                  textareaAriaLabel="评价方案描述"
                />
              </div>
            </div>
          ),
          contentClassName: 'overflow-y-auto',
        },
        {
          value: 'workflow',
          label: '工作流',
          content: (
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
              <ProfileWorkflowEditorBlock
                workflow={workflow}
                canvasKey={canvasKey}
                canvasRef={canvasRef}
                className="min-h-[320px]"
              />
            </div>
          ),
          contentClassName: 'overflow-hidden',
        },
      ]}
    >
      <form id={formId} className="hidden" aria-hidden onSubmit={(ev) => void onSubmit(ev)} />
    </PanelDetailCard>
  );
}

export default function EvaluationProfilesPage() {
  const items = useAtomValue(evaluationProfilesListAtoms.valueAtom);
  const listError = useAtomValue(evaluationProfilesListAtoms.errorAtom);
  const refreshList = useSetAtom(evaluationProfilesListAtoms.refreshAtom);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelIsEditing, setPanelIsEditing] = useAtom(evaluationProfilesPanelIsEditingAtom);
  const [editingId, setEditingId] = useState<string | null>(null);

  const cancelEditing = () => {
    setPanelIsEditing(false);
    setEditingId(null);
  };

  useNavigationEditGuard(evaluationProfilesPanelIsEditingAtom, { onAbandon: cancelEditing });

  const startCreate = () => {
    setEditingId(null);
    setPanelIsEditing(true);
  };

  const startEdit = (id: string) => {
    setEditingId(id);
    setPanelIsEditing(true);
  };

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  // 派生有效选中项：
  // - 用户点击后由 `selectedId` 决定
  // - 初始进入时默认选中第一项（无需 setState，避免 lint 规则）
  const effectiveSelectedId = useMemo(() => {
    if (selectedId) return selectedId;
    return items?.[0]?.id ?? null;
  }, [items, selectedId]);

  const sidebarItems = useMemo(() => {
    return (
      items?.map((p) => ({
        ...p,
        category: '评价方案',
      })) ?? null
    );
  }, [items]);

  const emptyText = getEmptyText(listError ?? null, items?.length ?? 0);

  return (
    <Page size="full" gap="sm" className="flex h-full min-h-0 w-full flex-row overflow-hidden">
      <CollapsibleSearchListSidebar collapsed={panelIsEditing} innerWidthClassName="w-[320px]">
        <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden">
          {listError ? (
            <Alert variant="destructive" className="mx-2">
              <AlertTitle>无法加载列表</AlertTitle>
              <AlertDescription>{listError}</AlertDescription>
            </Alert>
          ) : null}
          <SearchList
            className="h-full min-h-0"
            items={sidebarItems}
            getGroupKey={(item) => item.category}
            renderTitle={(item) => item.name}
            renderDescription={(item) => item.description ?? ''}
            getSearchText={(item) => [item.name, item.description ?? '', item.id].join(' ')}
            title="评价方案列表"
            searchPlaceholder="搜索评价方案"
            selectedId={effectiveSelectedId}
            emptyText={emptyText}
            loadingText={listError ? '加载失败' : '加载中…'}
            onItemSelected={(item) => setSelectedId(item.id)}
            toolbarRight={
              <button
                type="button"
                className={cn(buttonVariants({ variant: 'default', size: 'icon' }))}
                aria-label="新增评价方案"
                onClick={() => startCreate()}
              >
                <Plus className="size-4" aria-hidden />
              </button>
            }
          />
        </div>
      </CollapsibleSearchListSidebar>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {panelIsEditing ? (
          <EvaluationProfileEditorPanel
            profileId={editingId}
            onCancel={cancelEditing}
            onSaved={({ id }) => {
              setSelectedId(id);
              cancelEditing();
              void refreshList();
            }}
          />
        ) : (
          <EvaluationProfileDetailPanel selectedId={effectiveSelectedId} onEdit={(id) => startEdit(id)} />
        )}
      </div>
    </Page>
  );
}
