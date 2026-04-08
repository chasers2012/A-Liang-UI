import type { DataSourcePublic } from "@/lib/quant-agent-api";
import {
  createDatasource,
  patchDatasource,
} from "@/lib/quant-agent-api";

import type { EditorMode, FormState } from "./form-model";
import {
  mapFromRows,
  parseJsonObject,
  parseOptionalPort,
  sqlDriverFromApi,
} from "./form-model";

function validateSqlForCreate(form: FormState): void {
  if (!form.db_host.trim() || !form.db_name.trim()) {
    throw new Error("请填写主机（IP）与数据库名");
  }
  if (!form.date_column.trim() || !form.asset_column.trim()) {
    throw new Error("请选择或填写日期列与资产列");
  }
}

async function createDatasourceFromForm(
  form: FormState,
): Promise<DataSourcePublic> {
  if (!form.name.trim()) {
    throw new Error("请填写显示名称");
  }
  if (form.type === "sql") {
    validateSqlForCreate(form);
    return await createDatasource({
      name: form.name.trim(),
      type: "sql",
      enabled: form.enabled,
      sql: {
        db_driver: form.db_driver,
        db_host: form.db_host.trim(),
        db_port: parseOptionalPort(form.db_port),
        db_username: form.db_username.trim(),
        db_password: form.db_password,
        db_name: form.db_name.trim(),
        table: form.table.trim(),
        date_column: form.date_column.trim(),
        asset_column: form.asset_column.trim(),
        column_map: mapFromRows(form.column_map_rows),
      },
    });
  }
  return await createDatasource({
    name: form.name.trim(),
    type: "csv",
    enabled: form.enabled,
    csv: {
      path: form.csv_path.trim(),
      date_column: form.csv_date_column.trim(),
      asset_column: form.csv_asset_column.trim(),
      read_csv_kwargs: parseJsonObject(
        form.read_csv_kwargs_json,
        "read_csv_kwargs",
      ),
    },
  });
}

function buildSqlPatchForEdit(
  form: FormState,
  o: NonNullable<DataSourcePublic["sql"]>,
): Record<string, unknown> {
  const sqlPatch: Record<string, unknown> = {};
  const origDriver = sqlDriverFromApi(o.db_driver);
  if (form.db_driver !== origDriver) sqlPatch.db_driver = form.db_driver;
  if (form.db_host.trim() !== o.db_host) {
    sqlPatch.db_host = form.db_host.trim();
  }
  const newPort = parseOptionalPort(form.db_port);
  const origPort = o.db_port ?? undefined;
  if (newPort !== origPort) sqlPatch.db_port = newPort ?? null;
  if (form.db_username.trim() !== o.db_username) {
    sqlPatch.db_username = form.db_username.trim();
  }
  if (form.db_password.trim()) sqlPatch.db_password = form.db_password;
  if (form.db_name.trim() !== o.db_name) {
    sqlPatch.db_name = form.db_name.trim();
  }
  if (form.table.trim() !== o.table) sqlPatch.table = form.table.trim();
  if (form.date_column.trim() !== o.date_column) {
    sqlPatch.date_column = form.date_column.trim();
  }
  if (form.asset_column.trim() !== o.asset_column) {
    sqlPatch.asset_column = form.asset_column.trim();
  }
  const cm = mapFromRows(form.column_map_rows);
  if (JSON.stringify(cm) !== JSON.stringify(o.column_map)) {
    sqlPatch.column_map = cm;
  }
  return sqlPatch;
}

function buildCsvPatchForEdit(
  form: FormState,
  origCsv: NonNullable<DataSourcePublic["csv"]>,
): Record<string, unknown> {
  const csvPatch: Record<string, unknown> = {};
  if (form.csv_path.trim() !== origCsv.path) {
    csvPatch.path = form.csv_path.trim();
  }
  if (form.csv_date_column.trim() !== origCsv.date_column) {
    csvPatch.date_column = form.csv_date_column.trim();
  }
  if (form.csv_asset_column.trim() !== origCsv.asset_column) {
    csvPatch.asset_column = form.csv_asset_column.trim();
  }
  const kw = parseJsonObject(form.read_csv_kwargs_json, "read_csv_kwargs");
  if (JSON.stringify(kw) !== JSON.stringify(origCsv.read_csv_kwargs)) {
    csvPatch.read_csv_kwargs = kw;
  }
  return csvPatch;
}

function buildEditPatch(
  form: FormState,
  orig: DataSourcePublic,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  if (form.name.trim() !== orig.name) patch.name = form.name.trim();
  if (form.enabled !== orig.enabled) patch.enabled = form.enabled;

  if (form.type === "sql" && orig.sql) {
    const sqlPatch = buildSqlPatchForEdit(form, orig.sql);
    if (Object.keys(sqlPatch).length) patch.sql = sqlPatch;
  } else if (form.type === "csv" && orig.csv) {
    const csvPatch = buildCsvPatchForEdit(form, orig.csv);
    if (Object.keys(csvPatch).length) patch.csv = csvPatch;
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
