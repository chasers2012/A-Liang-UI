/** 数据源（SQL / CSV）相关 DTO，与 API 响应一致。 */

export type DataSourceType = "sql" | "csv";

export interface SqlPublic {
  db_driver: string;
  db_host: string;
  db_port: number | null;
  db_username: string;
  db_name: string;
  has_password: boolean;
  table: string;
  column_map: Record<string, string>;
}

export interface CsvPublic {
  path: string;
  read_csv_kwargs: Record<string, unknown>;
}

export interface DataSourcePublic {
  id: string;
  name: string;
  type: DataSourceType;
  enabled: boolean;
  sql: SqlPublic | null;
  csv: CsvPublic | null;
  created_at: string;
  updated_at: string;
}

export interface TestResult {
  ok: boolean;
  message: string;
}

export interface SqlTableColumnsRequestBody {
  datasource_id?: string | null;
  db_driver: string;
  db_host: string;
  db_port?: number | null;
  db_username: string;
  db_password: string;
  db_name: string;
  table: string;
}

export interface SqlTableColumnsResponseBody {
  columns: string[];
}
