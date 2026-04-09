import type { DataSourcePublic } from "@/lib/quant-agent-api";
import { createDatasource, patchDatasource } from "@/lib/quant-agent-api";

import type { EditorMode, FormState } from "./form-model";

async function createDatasourceFromForm(
  form: FormState,
): Promise<DataSourcePublic> {
  if (!form.name.trim()) {
    throw new Error("请填写显示名称");
  }
  if (!form.type.trim()) {
    throw new Error("请选择数据源类型");
  }
  return await createDatasource({
    name: form.name.trim(),
    type: form.type,
    config: form.config,
  });
}

function buildEditPatch(
  form: FormState,
  orig: DataSourcePublic,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  if (form.name.trim() !== orig.name) patch.name = form.name.trim();

  if (JSON.stringify(form.config) !== JSON.stringify(orig.config ?? {})) {
    patch.config = form.config;
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
  if (editorMode === "create") {
    return await createDatasourceFromForm(form);
  }

  if (!editingId) throw new Error("记录已不存在");
  const orig = items?.find((i) => i.id === editingId);
  if (!orig) throw new Error("记录已不存在");

  const patch = buildEditPatch(form, orig);
  if (Object.keys(patch).length === 0) return null;

  return await patchDatasource(editingId, patch);
}
