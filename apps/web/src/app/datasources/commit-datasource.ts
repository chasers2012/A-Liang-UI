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

/** @returns 保存后的记录；未调用 API（无变更）时返回 null */
export async function commitDatasourceForm(
  editorMode: EditorMode,
  editingId: string | null,
  form: FormState,
  items: DataSourcePublic[] | null,
): Promise<DataSourcePublic | null> {
  if (editorMode === "create") {
    if (form.type === "sql") {
      if (!form.db_host.trim() || !form.db_name.trim()) {
        throw new Error("请填写主机（IP）与数据库名");
      }
      return await createDatasource({
        name: form.name.trim(),
        type: "sql",
        enabled: form.enabled,
        is_default: form.is_default,
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
      is_default: form.is_default,
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

  if (!editingId) throw new Error("记录已不存在");
  const orig = items?.find((i) => i.id === editingId);
  if (!orig) throw new Error("记录已不存在");

  const patch: Record<string, unknown> = {};

  if (form.name.trim() !== orig.name) patch.name = form.name.trim();
  if (form.enabled !== orig.enabled) patch.enabled = form.enabled;
  if (form.is_default !== orig.is_default) patch.is_default = form.is_default;

  if (form.type === "sql" && orig.sql) {
    const o = orig.sql;
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
    if (Object.keys(sqlPatch).length) patch.sql = sqlPatch;
  } else if (form.type === "csv" && orig.csv) {
    const csvPatch: Record<string, unknown> = {};
    if (form.csv_path.trim() !== orig.csv.path) {
      csvPatch.path = form.csv_path.trim();
    }
    if (form.csv_date_column.trim() !== orig.csv.date_column) {
      csvPatch.date_column = form.csv_date_column.trim();
    }
    if (form.csv_asset_column.trim() !== orig.csv.asset_column) {
      csvPatch.asset_column = form.csv_asset_column.trim();
    }
    const kw = parseJsonObject(form.read_csv_kwargs_json, "read_csv_kwargs");
    if (JSON.stringify(kw) !== JSON.stringify(orig.csv.read_csv_kwargs)) {
      csvPatch.read_csv_kwargs = kw;
    }
    if (Object.keys(csvPatch).length) patch.csv = csvPatch;
  }

  if (Object.keys(patch).length === 0) return null;

  return await patchDatasource(editingId, patch);
}
