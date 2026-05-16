import type { DataSourcePublic } from '@/models/datasource/dto';
import { createDatasource, patchDatasource } from '@/api/datasources';

import type { EditorMode, FormState } from './form-model';

function dictLikeOrEmpty(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  return v as Record<string, unknown>;
}

async function createDatasourceFromForm(form: FormState): Promise<DataSourcePublic> {
  if (!form.name.trim()) {
    throw new Error('请填写显示名称');
  }
  if (!form.type.trim()) {
    throw new Error('请选择数据源类型');
  }
  const container = dictLikeOrEmpty(form.config);
  const connection = dictLikeOrEmpty(container.connection);
  const columns = dictLikeOrEmpty(container.columns);
  const write = dictLikeOrEmpty(container.write);
  return await createDatasource({
    name: form.name.trim(),
    type: form.type,
    connection_config: connection,
    columns_config: columns,
    write_config: write,
  });
}

function buildEditPatch(form: FormState, orig: DataSourcePublic): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  if (form.name.trim() !== orig.name) patch.name = form.name.trim();

  const container = dictLikeOrEmpty(form.config);
  const next = {
    connection: dictLikeOrEmpty(container.connection),
    columns: dictLikeOrEmpty(container.columns),
    write: dictLikeOrEmpty(container.write),
  };
  const origConfig = dictLikeOrEmpty(orig.config);
  const oc = dictLikeOrEmpty(origConfig.connection);
  const ocol = dictLikeOrEmpty(origConfig.columns);
  const ow = dictLikeOrEmpty(origConfig.write);
  if (JSON.stringify(next.connection) !== JSON.stringify(oc)) {
    patch.connection_config = next.connection;
  }
  if (JSON.stringify(next.columns) !== JSON.stringify(ocol)) {
    patch.columns_config = next.columns;
  }
  if (JSON.stringify(next.write) !== JSON.stringify(ow)) {
    patch.write_config = next.write;
  }

  return patch;
}

/** @returns 保存后的记录；未调用 API（无变更）时返回 null */
export async function commitDatasourceForm(
  editorMode: EditorMode,
  editingId: string | null,
  form: FormState,
  items: DataSourcePublic[] | null,
): Promise<DataSourcePublic | null> {
  if (editorMode === 'create') {
    return await createDatasourceFromForm(form);
  }

  if (!editingId) throw new Error('记录已不存在');
  const orig = items?.find((i) => i.id === editingId);
  if (!orig) throw new Error('记录已不存在');

  const patch = buildEditPatch(form, orig);
  if (Object.keys(patch).length === 0) return null;

  return await patchDatasource(editingId, patch);
}
