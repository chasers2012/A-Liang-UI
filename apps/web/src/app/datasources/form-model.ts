import type { DataSourcePublic, DataSourceType } from "@/lib/quant-agent-api";

export type ColumnMapRow = {
  factor: string;
  column: string;
  /** 为 false 时不写入 column_map；加载表列后为每列展示勾选 */
  enabled?: boolean;
};

export type SqlDriverForm = "postgresql" | "mysql";

export type EditorMode = "create" | "edit";

export type FormState = {
  name: string;
  type: DataSourceType;
  enabled: boolean;
  db_driver: SqlDriverForm;
  db_host: string;
  db_port: string;
  db_username: string;
  db_password: string;
  db_name: string;
  table: string;
  date_column: string;
  asset_column: string;
  column_map_rows: ColumnMapRow[];
  csv_path: string;
  csv_date_column: string;
  csv_asset_column: string;
  read_csv_kwargs_json: string;
};

export function emptyColumnMapRows(): ColumnMapRow[] {
  return [{ factor: "", column: "", enabled: true }];
}

export function rowsFromMap(m: Record<string, string>): ColumnMapRow[] {
  const e = Object.entries(m);
  if (e.length === 0) return emptyColumnMapRows();
  return e.map(([factor, column]) => ({ factor, column, enabled: true }));
}

export function mapFromRows(rows: ColumnMapRow[]): Record<string, string> {
  const o: Record<string, string> = {};
  for (const r of rows) {
    if (r.enabled === false) continue;
    const k = r.factor.trim();
    if (!k) continue;
    const col = r.column.trim();
    if (!col) continue;
    o[k] = col;
  }
  return o;
}

/** 将接口返回的列名与当前映射合并为完整行列表（用于加载表列后写回表单）。 */
export function mergeLoadedSqlColumns(
  apiColumns: string[],
  prev: ColumnMapRow[],
): ColumnMapRow[] {
  const colToFactor = new Map<string, string>();
  for (const r of prev) {
    if (r.enabled === false) continue;
    const c = r.column.trim();
    const f = r.factor.trim();
    if (c && f) colToFactor.set(c, f);
  }
  return apiColumns.map((column) => ({
    column,
    factor: colToFactor.get(column) ?? "",
    enabled: colToFactor.has(column),
  }));
}

export function emptyForm(): FormState {
  return {
    name: "",
    type: "sql",
    enabled: true,
    db_driver: "postgresql",
    db_host: "",
    db_port: "",
    db_username: "",
    db_password: "",
    db_name: "",
    table: "",
    date_column: "",
    asset_column: "",
    column_map_rows: emptyColumnMapRows(),
    csv_path: "",
    csv_date_column: "",
    csv_asset_column: "",
    read_csv_kwargs_json: "{}",
  };
}

export function sqlDriverFromApi(dbDriver: string): SqlDriverForm {
  return dbDriver === "mysql" || dbDriver === "mariadb"
    ? "mysql"
    : "postgresql";
}

export function hydrateFormFromDataSource(ds: DataSourcePublic): FormState {
  if (ds.type === "sql" && ds.sql) {
    const s = ds.sql;
    return {
      name: ds.name,
      type: "sql",
      enabled: ds.enabled,
      db_driver: sqlDriverFromApi(s.db_driver),
      db_host: s.db_host,
      db_port: s.db_port != null ? String(s.db_port) : "",
      db_username: s.db_username,
      db_password: "",
      db_name: s.db_name,
      table: s.table,
      date_column: s.date_column,
      asset_column: s.asset_column,
      column_map_rows: rowsFromMap(s.column_map),
      csv_path: "",
      csv_date_column: "",
      csv_asset_column: "",
      read_csv_kwargs_json: "{}",
    };
  }
  if (ds.type === "csv" && ds.csv) {
    return {
      ...emptyForm(),
      name: ds.name,
      type: "csv",
      enabled: ds.enabled,
      csv_path: ds.csv.path,
      csv_date_column: ds.csv.date_column,
      csv_asset_column: ds.csv.asset_column,
      read_csv_kwargs_json: JSON.stringify(ds.csv.read_csv_kwargs, null, 2),
    };
  }
  return emptyForm();
}

export function parseJsonObject(
  raw: string,
  label: string,
): Record<string, unknown> {
  const t = raw.trim();
  if (!t) return {};
  try {
    const v = JSON.parse(t) as unknown;
    if (v === null || typeof v !== "object" || Array.isArray(v)) {
      throw new Error(`${label} 须为 JSON 对象`);
    }
    return v as Record<string, unknown>;
  } catch (e) {
    if (e instanceof SyntaxError) {
      throw new Error(`${label} JSON 解析失败`);
    }
    throw e;
  }
}

export function parseOptionalPort(s: string): number | undefined {
  const t = s.trim();
  if (!t) return undefined;
  const n = parseInt(t, 10);
  if (Number.isNaN(n) || n < 1 || n > 65535) {
    throw new Error("端口须为 1–65535 的整数");
  }
  return n;
}
