import type {
  DataSourcePublic,
  DatasourcePluginPublic,
  DatasourceUploadFileResponse,
  SqlTableColumnsRequestBody,
  SqlTableColumnsResponseBody,
  TestResult,
} from "@/models";
import { ApiError, apiFetchJson, getQuantAgentApiBase, parseDetail } from "./client";

export function listDatasources(): Promise<DataSourcePublic[]> {
  return apiFetchJson<DataSourcePublic[]>("/datasources");
}

export function listDatasourcePlugins(): Promise<DatasourcePluginPublic[]> {
  return apiFetchJson<DatasourcePluginPublic[]>("/datasources/plugins");
}

export async function uploadDatasourceFile(
  file: File,
): Promise<DatasourceUploadFileResponse> {
  const url = `${getQuantAgentApiBase()}/uploads/file`;
  const body = new FormData();
  body.append("file", file);
  const res = await fetch(url, { method: "POST", body });
  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(parseDetail(text), res.status);
  }
  return res.json() as Promise<DatasourceUploadFileResponse>;
}

export function getDatasource(id: string): Promise<DataSourcePublic> {
  return apiFetchJson<DataSourcePublic>(
    `/datasources/${encodeURIComponent(id)}`,
  );
}

/** 数据源物理列名列表（供数据集配置 alias/date/asset 等映射使用）。 */
export function getDatasourceDependencyFields(
  id: string,
): Promise<{ fields: string[] }> {
  return apiFetchJson<{ fields: string[] }>(
    `/datasources/${encodeURIComponent(id)}/dependency-fields`,
  );
}

export function createDatasource(body: unknown): Promise<DataSourcePublic> {
  return apiFetchJson<DataSourcePublic>("/datasources", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function patchDatasource(
  id: string,
  body: unknown,
): Promise<DataSourcePublic> {
  return apiFetchJson<DataSourcePublic>(
    `/datasources/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    },
  );
}

export function deleteDatasource(id: string): Promise<void> {
  return apiFetchJson<void>(`/datasources/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function testDatasource(id: string): Promise<TestResult> {
  return apiFetchJson<TestResult>(
    `/datasources/${encodeURIComponent(id)}/test`,
    { method: "POST" },
  );
}

export function fetchSqlTableColumns(
  body: SqlTableColumnsRequestBody,
): Promise<SqlTableColumnsResponseBody> {
  return apiFetchJson<SqlTableColumnsResponseBody>(
    "/datasources/sql-table-columns",
    {
      method: "POST",
      body: JSON.stringify({
        ...(body.datasource_id ? { datasource_id: body.datasource_id } : {}),
        db_driver: body.db_driver,
        db_host: body.db_host,
        db_port: body.db_port ?? null,
        db_username: body.db_username,
        db_password: body.db_password,
        db_name: body.db_name,
        table: body.table,
      }),
    },
  );
}
