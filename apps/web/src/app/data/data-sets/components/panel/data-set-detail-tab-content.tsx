'use client';

import { useAtomValue, useSetAtom } from 'jotai';

import { EmptyState, PanelPlaceholder } from '@/components/empty-state';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { DataSourcePublic } from '@/models/datasource/dto';
import { dataSetAtoms } from '@/models/data-set/panel-detail.atom';
import { dataSetsSelectedIdAtom } from '@/models/data-set/selection.atom';
import { dataSetDetailAsyncStateAtomFamily, refreshDataSetDetailAtomFamily } from '@/models/data-set/detail.atom';
import { dataSetEditorStateAtom } from '@/models/data-set/editor/form-state.atom';
import {
  dataSetEditorDatasourcesAsyncStateAtom,
  editorDependencyFieldsByDsIdAsyncStateAtom,
  selectedDataSetDependencyFieldsByDsIdAsyncStateAtom,
} from '@/models/data-set/editor/datasources.atom';
import { hydrateDataSetForm } from '@/models/data-set/form-logic';

import { DataSetDetailFormContent } from './data-set-detail-form-content';

// eslint-disable-next-line complexity
export function DataSetDetailTabContent(props: { isEditing: boolean }) {
  const { isEditing } = props;

  const dataSetId = (useAtomValue(dataSetsSelectedIdAtom) ?? '').trim();
  const loadError = useAtomValue(dataSetAtoms.errorAtom);

  const detailState = useAtomValue(dataSetDetailAsyncStateAtomFamily(dataSetId || null));
  const row = detailState.value ?? null;
  const loading = detailState.loading;
  const error = detailState.error;
  const refreshDetail = useSetAtom(refreshDataSetDetailAtomFamily(dataSetId));

  const datasourcesState = useAtomValue(dataSetEditorDatasourcesAsyncStateAtom);
  const bindingDatasources: DataSourcePublic[] = datasourcesState.value ?? [];
  const detailDependencyFieldsByDsId = useAtomValue(selectedDataSetDependencyFieldsByDsIdAsyncStateAtom).value ?? {};

  const editorState = useAtomValue(dataSetEditorStateAtom);
  const { editorLoading, formError, form } = editorState;
  const dependencyFieldsByDsId = useAtomValue(editorDependencyFieldsByDsIdAsyncStateAtom).value ?? {};

  if (!dataSetId && !isEditing && loadError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>无法加载列表</AlertTitle>
        <AlertDescription>{loadError}</AlertDescription>
      </Alert>
    );
  }

  if (!dataSetId && !isEditing) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <PanelPlaceholder title="请选择数据集" description="从左侧选择一个数据集，或点击「新增数据集」。" />
      </div>
    );
  }

  if ((isEditing && editorLoading) || (!isEditing && loading)) {
    return <EmptyState variant="loading" title="加载中" compact />;
  }

  if (!isEditing && dataSetId && (error || !row)) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <Alert variant="destructive">
          <AlertTitle>无法加载数据集</AlertTitle>
          <AlertDescription>{error ?? '未知错误'}</AlertDescription>
        </Alert>
        <Button type="button" variant="outline" onClick={() => refreshDetail()}>
          重试
        </Button>
      </div>
    );
  }

  if (isEditing && !form) {
    return (
      <Alert variant="destructive">
        <AlertTitle>无法加载表单</AlertTitle>
        <AlertDescription>当前未能初始化数据集表单，请返回详情后重试。</AlertDescription>
      </Alert>
    );
  }

  return (
    <DataSetDetailFormContent
      form={isEditing ? form : hydrateDataSetForm(row!)}
      bindingDatasources={bindingDatasources}
      dependencyFieldsByDsId={isEditing ? dependencyFieldsByDsId : detailDependencyFieldsByDsId}
      formError={isEditing ? formError : null}
      readOnly={!isEditing}
    />
  );
}
