'use client';

import { useAtomValue, useSetAtom } from 'jotai';

import { Button } from '@/components/ui/button';
import { useContext, useLayoutEffect } from 'react';
import { PageAppHeaderContext } from '@/components/page-app-header-context';
import {
  dataSetsEnterEditAtom,
  dataSetsExitFormToDetailAtom,
  dataSetsIsEditingAtom,
} from '@/models/data-set/panel-ui.atom';
import { dataSetsSelectedIdAtom } from '@/models/data-set/selection.atom';
import { dataSetDetailAsyncStateAtomFamily } from '@/models/data-set/detail.atom';
import { dataSetEditorStateAtom, submitDataSetEditorAtom } from '@/models/data-set/editor/form-state.atom';
import { dataSetEditorDatasourcesAsyncStateAtom } from '@/models/data-set/editor/datasources.atom';
import { confirmDeleteDataSetAtom, dataSetDeleteStateAtom } from '@/models/data-set/delete.atom';

import { DeleteDataSetDialog } from './delete-data-set-dialog';

export function DataSetPanelHeaderActions(props: { onOpenDelete: () => void }) {
  const { onOpenDelete } = props;
  const isEditing = useAtomValue(dataSetsIsEditingAtom);
  const dataSetId = (useAtomValue(dataSetsSelectedIdAtom) ?? '').trim();
  const detailState = useAtomValue(dataSetDetailAsyncStateAtomFamily(dataSetId || null));
  const detailRow = detailState.value ?? null;
  const detailLoading = detailState.loading;
  const detailError = detailState.error;
  const enterEdit = useSetAtom(dataSetsEnterEditAtom);
  const exitFormToDetail = useSetAtom(dataSetsExitFormToDetailAtom);
  const submitEditor = useSetAtom(submitDataSetEditorAtom);
  const { submitting, form } = useAtomValue(dataSetEditorStateAtom);
  const bindingDatasources = useAtomValue(dataSetEditorDatasourcesAsyncStateAtom).value ?? [];
  const chrome = useContext(PageAppHeaderContext);

  useLayoutEffect(() => {
    if (!isEditing || chrome == null) return;
    chrome.suppressBackLink(true);
    return () => {
      chrome.suppressBackLink(false);
    };
  }, [isEditing, chrome]);

  if (isEditing) {
    return (
      <>
        <Button type="button" variant="outline" size="sm" onClick={exitFormToDetail}>
          取消
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={submitting || bindingDatasources.length === 0 || !form.name.trim()}
          onClick={() => void submitEditor({ dataSetId })}
        >
          {submitting ? '保存中…' : '保存'}
        </Button>
      </>
    );
  }

  if (!dataSetId || !detailRow || detailLoading || detailError) return null;

  return (
    <>
      <Button type="button" variant="default" className="shrink-0" onClick={enterEdit}>
        编辑
      </Button>
      <Button type="button" variant="destructive" className="shrink-0" onClick={onOpenDelete}>
        删除
      </Button>
    </>
  );
}

export function DataSetPanelDialogs(props: { deleteOpen: boolean; onOpenDelete: (open: boolean) => void }) {
  const { deleteOpen, onOpenDelete } = props;
  const isEditing = useAtomValue(dataSetsIsEditingAtom);
  const dataSetId = (useAtomValue(dataSetsSelectedIdAtom) ?? '').trim();
  const detailRow = useAtomValue(dataSetDetailAsyncStateAtomFamily(dataSetId || null)).value ?? null;
  const deleteState = useAtomValue(dataSetDeleteStateAtom);
  const confirmDelete = useSetAtom(confirmDeleteDataSetAtom);

  if (isEditing || !detailRow) return null;

  return (
    <>
      <DeleteDataSetDialog
        target={deleteOpen ? detailRow : null}
        deleting={deleteState.deleting}
        onDismiss={() => onOpenDelete(false)}
        onConfirm={() => void confirmDelete(detailRow.id)}
      />
    </>
  );
}
