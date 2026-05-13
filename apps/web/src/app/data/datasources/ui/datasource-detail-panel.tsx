'use client';

import { useMemo } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';

import { Button } from '@/components/ui/button';
import { PanelDetailCard } from '@/components/panel-detail-card';
import {
  cancelDatasourceEditorAtom,
  clearDatasourceTransientAlertsAtom,
  datasourceEditorProceedFromBaseTabAtom,
  datasourcesBusyIdAtom,
  datasourcesDeleteErrorAtom,
  datasourcesDetailActiveTabAtom,
  datasourcesEditorFormAtom,
  datasourcesEditorLoadEffectAtom,
  datasourcesEditorMainFormValidAtom,
  datasourcesEditorSubmittingAtom,
  datasourcesInspectColumnsBusyAtom,
  datasourcesInspectColumnsErrorAtom,
  datasourcesIsEditingAtom,
  datasourcesPluginBaseConfigValidAtom,
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
  const pluginBaseFormValid = useAtomValue(datasourcesPluginBaseConfigValidAtom);
  const pluginFormValid = useAtomValue(datasourcesPluginConfigValidAtom);
  const detailTab = useAtomValue(datasourcesDetailActiveTabAtom);
  const inspecting = useAtomValue(datasourcesInspectColumnsBusyAtom);
  const saveEditor = useSetAtom(saveDatasourceEditorAtom);
  const cancelEditor = useSetAtom(cancelDatasourceEditorAtom);
  const proceedFromBase = useSetAtom(datasourceEditorProceedFromBaseTabAtom);
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

  const onBaseTab = detailTab === 'base';

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={submitting || inspecting}
        onClick={() => void cancelEditor()}
      >
        取消
      </Button>
      {onBaseTab ? (
        <Button
          type="button"
          size="sm"
          disabled={submitting || inspecting || !mainFormValid || !pluginBaseFormValid}
          onClick={() => void proceedFromBase()}
        >
          {inspecting ? '探测中…' : '下一步'}
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          disabled={submitting || !mainFormValid || !pluginFormValid}
          onClick={() => void saveEditor()}
        >
          {submitting ? '保存中…' : '保存'}
        </Button>
      )}
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
  const mainFormValid = useAtomValue(datasourcesEditorMainFormValidAtom);
  const pluginBaseFormValid = useAtomValue(datasourcesPluginBaseConfigValidAtom);
  const selectedId = useAtomValue(datasourcesSelectedIdAtom);
  const [deleteError] = useAtom(datasourcesDeleteErrorAtom);
  const [testHint] = useAtom(datasourcesTestHintAtom);
  const [form] = useAtom(datasourcesEditorFormAtom);
  const selectedItem = useAtomValue(datasourcesSelectedListItemAtom);
  const [detailTab, setDetailTab] = useAtom(datasourcesDetailActiveTabAtom);
  const [inspectColumnsError] = useAtom(datasourcesInspectColumnsErrorAtom);
  const proceedFromBase = useSetAtom(datasourceEditorProceedFromBaseTabAtom);
  const clearTransientAlerts = useSetAtom(clearDatasourceTransientAlertsAtom);

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
      panelActiveTab={detailTab}
      onPanelActiveTabChange={(v) => {
        if (v !== 'base' && v !== 'fields') return;
        if (v === 'base') {
          if (detailTab !== 'base') clearTransientAlerts();
          setDetailTab('base');
          return;
        }
        if (!isEditing) {
          if (detailTab !== 'fields') clearTransientAlerts();
          setDetailTab('fields');
          return;
        }
        if (!mainFormValid || !pluginBaseFormValid) return;
        clearTransientAlerts();
        void proceedFromBase();
      }}
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
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>删除失败</AlertTitle>
          <AlertDescription>{deleteError}</AlertDescription>
        </Alert>
      )}
      {testHint && (
        <Alert variant={testHint.ok ? 'default' : 'destructive'} className="mb-4">
          <AlertTitle>连接测试</AlertTitle>
          <AlertDescription>{testHint.message}</AlertDescription>
        </Alert>
      )}
      {inspectColumnsError && isEditing ? (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>列探测失败</AlertTitle>
          <AlertDescription>{inspectColumnsError}</AlertDescription>
        </Alert>
      ) : null}

      {!isEditing && !selectedId && (
        <p className="text-sm text-muted-foreground">从左侧选择一个数据源，或点击「新增数据源」。</p>
      )}
    </PanelDetailCard>
  );
}
