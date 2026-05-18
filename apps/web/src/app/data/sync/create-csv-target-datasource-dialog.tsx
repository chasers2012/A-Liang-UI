'use client';

import { useCallback, useEffect, useState } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  createCsvTargetDatasourceFromSources,
  resolveSourceColumnsForCsvTarget,
} from '@/models/data-sync/create-csv-target-datasource';
import type { DataSourcePublic } from '@/models/datasource/dto';
import { datasourceDisplayLabel, type DatasourceLabelSnapshot } from '@/models/data-sync/task-form';

type Props = {
  open: boolean;
  sourceIds: string[];
  datasources: DataSourcePublic[];
  datasourceLabels: Record<string, DatasourceLabelSnapshot>;
  onClose: () => void;
  onCreated: (created: DataSourcePublic) => void;
};

export function CreateCsvTargetDatasourceDialog(props: Props) {
  const { open, sourceIds, datasources, datasourceLabels, onClose, onCreated } = props;

  const [name, setName] = useState('');
  const [previewColumns, setPreviewColumns] = useState<string[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const resetForm = useCallback(() => {
    setName('');
    setPreviewColumns([]);
    setPreviewError(null);
    setSubmitError(null);
    setPreviewLoading(false);
    setSubmitting(false);
  }, []);

  useEffect(() => {
    if (!open) {
      resetForm();
      return;
    }
    const ids = sourceIds.map((x) => x.trim()).filter(Boolean);
    if (ids.length === 0) {
      setPreviewColumns([]);
      setPreviewError('请先选择源数据源。');
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    setPreviewError(null);
    void resolveSourceColumnsForCsvTarget(ids)
      .then((spec) => {
        if (cancelled) return;
        setPreviewColumns(spec.columns);
      })
      .catch((e) => {
        if (cancelled) return;
        setPreviewColumns([]);
        setPreviewError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, sourceIds, resetForm]);

  const sourceSummary = sourceIds.map((id) => datasourceDisplayLabel(id, datasources, datasourceLabels)).join('、');

  const handleCreate = async () => {
    setSubmitError(null);
    setSubmitting(true);
    try {
      const created = await createCsvTargetDatasourceFromSources({ name, sourceIds });
      onCreated(created);
      onClose();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit =
    !submitting && !previewLoading && !previewError && previewColumns.length > 0 && name.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <DialogContent size="md" className="gap-0">
        <DialogHeader title="新建 CSV 目标数据源">
          将根据所选源数据源的列名创建可写入的 CSV 文件（保存后自动加入目标数据源列表）。
        </DialogHeader>
        <DialogBody variant="inset" className="space-y-4">
          <Field className="gap-2">
            <FieldLabel htmlFor="csv-target-name">显示名称</FieldLabel>
            <Input
              id="csv-target-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：同步结果 CSV"
              autoFocus
            />
          </Field>
          <div className="space-y-1.5 text-sm">
            <p className="text-muted-foreground">
              源数据源：<span className="text-foreground">{sourceSummary || '（未选择）'}</span>
            </p>
            {previewLoading ? (
              <p className="text-muted-foreground">正在读取列名…</p>
            ) : previewError ? (
              <Alert variant="destructive">
                <AlertDescription>{previewError}</AlertDescription>
              </Alert>
            ) : (
              <p className="text-muted-foreground">
                将写入 {previewColumns.length} 列：
                <span className="mt-1 block font-mono text-xs text-foreground wrap-break-word">
                  {previewColumns.join(', ')}
                </span>
              </p>
            )}
          </div>
          {submitError ? (
            <Alert variant="destructive">
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={submitting} onClick={onClose}>
            取消
          </Button>
          <Button type="button" disabled={!canSubmit} onClick={() => void handleCreate()}>
            {submitting ? '创建中…' : '创建并选为目标'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
