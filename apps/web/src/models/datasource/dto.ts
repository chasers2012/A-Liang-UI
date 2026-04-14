/** 数据源（插件化 config）相关 DTO，与 API 响应一致。 */

export type DataSourceType = string;

export interface DataSourcePublic {
  id: string;
  name: string;
  type: DataSourceType;
  config: Record<string, unknown>;
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

export interface DatasourcePluginPublic {
  type: string;
  title: string;
  description: string | null;
  json_schema: Record<string, unknown>;
  ui_schema: Record<string, unknown>;
}

/** `/uploads/file` 响应。 */
export interface UploadFileResponse {
  path: string;
  filename: string;
  size: number;
}
