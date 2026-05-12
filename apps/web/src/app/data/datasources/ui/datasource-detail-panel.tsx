'use client';

import { useMemo } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';

import { Button } from '@/components/ui/button';
import { PanelDetailCard } from '@/components/panel-detail-card';
import {
  cancelDatasourceEditorAtom,
  datasourcesBusyIdAtom,
  datasourcesDeleteErrorAtom,
  datasourcesDetailLoadErrorAtom,
  datasourcesDetailLoadingAtom,
  datasourcesEditorFormAtom,
  datasourcesEditorLoadEffectAtom,
  datasourcesEditorMainFormValidAtom,
  datasourcesEditorSubmittingAtom,
  datasourcesIsEditingAtom,
  datasourcesPluginConfigValidAtom,
  datasourcesPluginsCatalogEffectAtom,
  datasourcesSelectedIdAtom,
  datasourcesSelectedListItemAtom,
  datasourcesSyncViewFormEffectAtom,
  datasourcesTestHintAtom,
  enterDatasourceEditorAtom,
  requestDeleteDatasourceAtom,
  saveDatasourceEditorAtom,
  testDatasourceConnectionAtom,
} from '@/models/datasource/panel.atom';

import { EditablePageTitle } from '@/components/editable-page-title';
import { Badge } from '@/components/reui/badge';
import { DatasourceBasePanelContent } from './datasource-base-panel-content';
import { DatasourceFieldsPanelContent } from './datasource-fields-panel-content';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

function DatasourceDetailActions() {
  const isEditing = useAtomValue(datasourcesIsEditingAtom);
  const selectedItem = useAtomValue(datasourcesSelectedListItemAtom);
  const submitting = useAtomValue(datasourcesEditorSubmittingAtom);
  const mainFormValid = useAtomValue(datasourcesEditorMainFormValidAtom);
  const pluginFormValid = useAtomValue(datasourcesPluginConfigValidAtom);
  const saveEditor = useSetAtom(saveDatasourceEditorAtom);
  const cancelEditor = useSetAtom(cancelDatasourceEditorAtom);
  const runTest = useSetAtom(testDatasourceConnectionAtom);
  const busyId = useAtomValue(datasourcesBusyIdAtom);
  const enterEditor = useSetAtom(enterDatasourceEditorAtom);
  const requestDelete = useSetAtom(requestDeleteDatasourceAtom);

  if (!isEditing) {
    if (!selectedItem) return null;
    return (
      <>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={busyId === selectedItem.id}
          onClick={() => void runTest(selectedItem.id)}
        >
          测试连接
        </Button>
        <Button type="button" variant="default" size="sm" onClick={() => void enterEditor()}>
          编辑
        </Button>
        <Button type="button" variant="destructive" size="sm" onClick={() => void requestDelete(selectedItem)}>
          删除
        </Button>
      </>
    );
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" disabled={submitting} onClick={() => void cancelEditor()}>
        取消
      </Button>
      <Button
        type="button"
        size="sm"
        disabled={submitting || !mainFormValid || !pluginFormValid}
        onClick={() => void saveEditor()}
      >
        {submitting ? '保存中…' : '保存'}
      </Button>
    </>
  );
}

/**
 * 右侧主区：统一只渲染一个 {@link PanelDetailCard}。
 * - `view` / `create` / `edit`：内容在 children 内分支，不再额外包一层 `PanelDetailCard`
 */
export function DatasourceDetailPanel() {
  useAtom(datasourcesPluginsCatalogEffectAtom);
  useAtom(datasourcesSyncViewFormEffectAtom);
  useAtom(datasourcesEditorLoadEffectAtom);

  const isEditing = useAtomValue(datasourcesIsEditingAtom);
  const selectedId = useAtomValue(datasourcesSelectedIdAtom);
  const [deleteError] = useAtom(datasourcesDeleteErrorAtom);
  const [testHint] = useAtom(datasourcesTestHintAtom);
  const [form] = useAtom(datasourcesEditorFormAtom);
  const [loadError] = useAtom(datasourcesDetailLoadErrorAtom);
  const [loading] = useAtom(datasourcesDetailLoadingAtom);
  const selectedItem = useAtomValue(datasourcesSelectedListItemAtom);

  const detailPanels = useMemo(
    () =>
      [
        { value: 'base', label: '基础配置', content: <DatasourceBasePanelContent /> },
        { value: 'fields', label: '字段映射', content: <DatasourceFieldsPanelContent /> },
      ] as const,
    [],
  );

  return (
    <PanelDetailCard
      title={
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <EditablePageTitle
            value={form.name}
            onChange={() => {
              /* view mode: no rename */
            }}
            showEdit={isEditing}
            inputAriaLabel="数据源显示名称"
            placeholder="数据源"
            editButtonAriaLabel="编辑名称"
          />
          {selectedItem?.type && <Badge variant="secondary">{String(selectedItem.type || '').toUpperCase()}</Badge>}
        </div>
      }
      actions={<DatasourceDetailActions />}
      panels={detailPanels}
    >
      {deleteError && (
        <Alert variant="destructive">
          <AlertTitle>删除失败</AlertTitle>
          <AlertDescription>{deleteError}</AlertDescription>
        </Alert>
      )}
      {testHint && (
        <Alert variant={testHint.ok ? 'default' : 'destructive'}>
          <AlertTitle>连接测试</AlertTitle>
          <AlertDescription>{testHint.message}</AlertDescription>
        </Alert>
      )}
      {loadError && (
        <Alert variant="destructive">
          <AlertTitle>无法加载数据源</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}
      {loading && <p className="text-sm text-muted-foreground">加载中…</p>}
      {!isEditing && !selectedId && (
        <p className="text-sm text-muted-foreground">从左侧选择一个数据源，或点击「新增数据源」。</p>
      )}
    </PanelDetailCard>
  );
}
