'use client';

import { useAtomValue, useSetAtom } from 'jotai';

import { EmptyState } from '@/components/empty-state';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PanelDetailCard } from '@/components/panel-detail-card';
import { EditablePageTitle } from '@/components/editable-page-title';
import {
  factorsDetailErrorAtom,
  factorsDetailLoadingAtom,
  factorsEditNameAtom,
  factorsEditingAtom,
  factorsVisibleDetailAtom,
  factorsSelectedIdAtom,
} from '@/models/factor';
import { PanelOverviewTab } from './panel-overview-tab';
import { PanelSourceTab } from './panel-source-tab';
import { FactorDetailToolbarButton } from './panel-edit-toolbar-button';

/** 未选中 / 加载中 / 加载失败时主区提示（不渲染 Tab 面板） */
function FactorDetailStatus() {
  const selectedId = useAtomValue(factorsSelectedIdAtom);
  const editing = useAtomValue(factorsEditingAtom);
  const loading = useAtomValue(factorsDetailLoadingAtom) && selectedId != null;
  const loadError = useAtomValue(factorsDetailErrorAtom);

  if (!selectedId && !editing) {
    return (
      <Alert>
        <AlertDescription>请选择左侧因子后查看详情。</AlertDescription>
      </Alert>
    );
  }

  if (loading) {
    return <EmptyState variant="loading" title="加载中" description="正在加载因子详情…" compact />;
  }

  if (loadError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>详情加载失败：{String(loadError)}</AlertDescription>
      </Alert>
    );
  }

  return null;
}

export function FactorDetailPanel() {
  const setEditName = useSetAtom(factorsEditNameAtom);
  const editing = useAtomValue(factorsEditingAtom);
  const detail = useAtomValue(factorsVisibleDetailAtom);
  const selectedId = useAtomValue(factorsSelectedIdAtom);
  const loading = useAtomValue(factorsDetailLoadingAtom) && selectedId != null;
  const loadError = useAtomValue(factorsDetailErrorAtom);

  const showTabPanels = (Boolean(selectedId) || editing) && !loading && !loadError;

  return (
    <PanelDetailCard
      title={
        <EditablePageTitle
          showEdit={editing}
          value={detail?.name ?? ''}
          onChange={(name) => {
            setEditName(name);
          }}
          inputAriaLabel="编辑因子名称"
          editButtonAriaLabel="编辑因子名称"
          placeholder="因子详情"
        />
      }
      actions={<FactorDetailToolbarButton />}
      {...(showTabPanels
        ? {
            panels: [
              {
                value: 'overview',
                label: '概览',
                content: <PanelOverviewTab />,
                contentClassName: 'overflow-y-auto',
              },
              {
                value: 'source',
                label: '源码',
                content: <PanelSourceTab />,
                contentClassName: 'overflow-y-auto',
              },
            ],
          }
        : { children: <FactorDetailStatus /> })}
    />
  );
}
