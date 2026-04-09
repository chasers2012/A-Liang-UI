import type { DataSourcePublic, DataSourceType } from "@/lib/quant-agent-api";

export type SqlDriverForm = "postgresql" | "mysql";

export type EditorMode = "create" | "edit";

export type ColumnMapRow = {
  factor: string;
  column: string;
  enabled: boolean;
};

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
  csv_path: string;
  read_csv_kwargs_json: string;
};

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
    csv_path: "",
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
      csv_path: "",
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
