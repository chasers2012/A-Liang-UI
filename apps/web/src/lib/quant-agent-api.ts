/** Base URL for quant-agent FastAPI (no trailing slash). */
export function getQuantAgentApiBase(): string {
  const raw =
    process.env.NEXT_PUBLIC_QUANT_AGENT_API ?? "http://127.0.0.1:8000";
  return raw.replace(/\/$/, "");
}

export type DataSourceType = "sql" | "csv";

export interface SqlPublic {
  db_driver: string;
  db_host: string;
  db_port: number | null;
  db_username: string;
  db_name: string;
  has_password: boolean;
  has_legacy_engine_url: boolean;
  table: string;
  date_column: string;
  asset_column: string;
  column_map: Record<string, string>;
}

export interface CsvPublic {
  path: string;
  date_column: string;
  asset_column: string;
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

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function parseDetail(text: string): string {
  try {
    const j = JSON.parse(text) as { detail?: unknown };
    if (typeof j.detail === "string") return j.detail;
    if (Array.isArray(j.detail)) {
      return j.detail
        .map((d) =>
          typeof d === "object" && d && "msg" in d
            ? String((d as { msg: string }).msg)
            : String(d),
        )
        .join("; ");
    }
  } catch {
    /* ignore */
  }
  return text || "请求失败";
}

export async function apiFetchJson<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = `${getQuantAgentApiBase()}${path.startsWith("/") ? path : `/${path}`}`;
  const hasJsonBody = typeof init?.body === "string" && init.body.length > 0;
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(hasJsonBody ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(parseDetail(text), res.status);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

export function listDatasources(): Promise<DataSourcePublic[]> {
  return apiFetchJson<DataSourcePublic[]>("/datasources");
}

export function getDatasource(id: string): Promise<DataSourcePublic> {
  return apiFetchJson<DataSourcePublic>(
    `/datasources/${encodeURIComponent(id)}`,
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

export function fetchSqlTableColumns(
  body: SqlTableColumnsRequestBody,
): Promise<SqlTableColumnsResponseBody> {
  return apiFetchJson<SqlTableColumnsResponseBody>(
    "/datasources/sql-table-columns",
    {
      method: "POST",
      body: JSON.stringify({
        ...(body.datasource_id
          ? { datasource_id: body.datasource_id }
          : {}),
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

export interface FactorSummaryPublic {
  id: string;
  name: string;
  group: string;
  group_label: string;
  description: string;
  max_window: number;
  dependencies: string[];
  source_path: string;
  created_at: string;
  updated_at: string;
}

export interface FactorDetailPublic extends FactorSummaryPublic {
  source: string;
}

export function listFactors(): Promise<FactorSummaryPublic[]> {
  return apiFetchJson<FactorSummaryPublic[]>("/factors");
}

export function getFactor(id: string): Promise<FactorDetailPublic> {
  return apiFetchJson<FactorDetailPublic>(`/factors/${encodeURIComponent(id)}`);
}

export function createFactor(body: unknown): Promise<FactorDetailPublic> {
  return apiFetchJson<FactorDetailPublic>("/factors", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function patchFactor(
  id: string,
  body: unknown,
): Promise<FactorDetailPublic> {
  return apiFetchJson<FactorDetailPublic>(
    `/factors/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(body) },
  );
}

export function deleteFactor(id: string): Promise<void> {
  return apiFetchJson<void>(`/factors/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export interface FactorEvaluationsAggregatePublic {
  total_factors: number;
  evaluated_count: number;
  unevaluated_count: number;
  primary_period: string;
  mean_ic_primary_avg: number | null;
}

export interface FactorEvaluationRowPublic {
  factor_id: string;
  name: string;
  has_evaluation: boolean;
  evaluated_at?: string | null;
  window?: { start?: string | null; end?: string | null } | null;
  stock_count?: number | null;
  mean_ic: Record<string, number>;
  mean_return_spread?: Record<string, number>;
  error?: string | null;
  /** Present when the run used a named evaluation profile (with or without workflow nodes). */
  evaluation_profile_id?: string | null;
  /** Workflow node id → output socket → value (e.g. period → scalar for IC/spread). */
  metric_results?: Record<string, unknown>;
}

export interface FactorEvaluationsSummaryPublic {
  aggregate: FactorEvaluationsAggregatePublic;
  rows: FactorEvaluationRowPublic[];
}

export function getFactorEvaluationsSummary(): Promise<FactorEvaluationsSummaryPublic> {
  return apiFetchJson<FactorEvaluationsSummaryPublic>(
    "/factors/evaluations/summary",
  );
}

export type FactorCodeSnapshotKind = "auto" | "manual";

export interface FactorCodeSnapshotMeta {
  name: string;
  group: string;
  group_label: string;
  description: string;
  max_window: number;
  dependencies: string[];
}

export interface FactorCodeSnapshotSummaryPublic {
  id: string;
  saved_at: string;
  kind: FactorCodeSnapshotKind;
  label?: string | null;
  meta: FactorCodeSnapshotMeta;
}

export interface FactorCodeSnapshotDetailPublic extends FactorCodeSnapshotSummaryPublic {
  source: string;
}

export interface FactorEvaluationHistoryEntry {
  id: string;
  linked_snapshot_id?: string | null;
  evaluated_at: string;
  window?: { start?: string | null; end?: string | null } | null;
  stock_count?: number | null;
  mean_ic: Record<string, number>;
  mean_return_spread?: Record<string, number>;
  error?: string | null;
}

export function listFactorSnapshots(
  factorId: string,
): Promise<FactorCodeSnapshotSummaryPublic[]> {
  return apiFetchJson<FactorCodeSnapshotSummaryPublic[]>(
    `/factors/${encodeURIComponent(factorId)}/snapshots`,
  );
}

export function getFactorSnapshot(
  factorId: string,
  snapshotId: string,
): Promise<FactorCodeSnapshotDetailPublic> {
  return apiFetchJson<FactorCodeSnapshotDetailPublic>(
    `/factors/${encodeURIComponent(factorId)}/snapshots/${encodeURIComponent(snapshotId)}`,
  );
}

export function getFactorEvaluationHistory(
  factorId: string,
): Promise<FactorEvaluationHistoryEntry[]> {
  return apiFetchJson<FactorEvaluationHistoryEntry[]>(
    `/factors/${encodeURIComponent(factorId)}/evaluations/history`,
  );
}

export interface EvaluationTestSetDatasourceBindingPublic {
  datasource_id: string;
  datasource_name: string;
  datasource_type: string;
  dependencies: string[];
}

export interface EvaluationTestSetPublic {
  id: string;
  name: string;
  description: string;
  datasource_bindings: EvaluationTestSetDatasourceBindingPublic[];
  start: string;
  end: string;
  stock_codes: string[];
  quantiles: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export function listEvaluationTestSets(): Promise<EvaluationTestSetPublic[]> {
  return apiFetchJson<EvaluationTestSetPublic[]>("/evaluation-test-sets");
}

export function getEvaluationTestSet(
  id: string,
): Promise<EvaluationTestSetPublic> {
  return apiFetchJson<EvaluationTestSetPublic>(
    `/evaluation-test-sets/${encodeURIComponent(id)}`,
  );
}

export function createEvaluationTestSet(
  body: unknown,
): Promise<EvaluationTestSetPublic> {
  return apiFetchJson<EvaluationTestSetPublic>("/evaluation-test-sets", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function patchEvaluationTestSet(
  id: string,
  body: unknown,
): Promise<EvaluationTestSetPublic> {
  return apiFetchJson<EvaluationTestSetPublic>(
    `/evaluation-test-sets/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(body) },
  );
}

export function deleteEvaluationTestSet(id: string): Promise<void> {
  return apiFetchJson<void>(`/evaluation-test-sets/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function runFactorEvaluation(
  factorId: string,
  options?: {
    testSetId?: string | null;
    evaluationProfileId?: string | null;
  },
): Promise<FactorEvaluationRowPublic> {
  const init: RequestInit = { method: "POST" };
  if (options !== undefined) {
    init.body = JSON.stringify({
      test_set_id: options.testSetId ?? null,
      evaluation_profile_id: options.evaluationProfileId ?? null,
    });
  }
  return apiFetchJson<FactorEvaluationRowPublic>(
    `/factors/${encodeURIComponent(factorId)}/evaluations/run`,
    init,
  );
}

export type MetricVisualizationMode =
  | "auto"
  | "bars"
  | "bars_diverging"
  | "table"
  | "json"
  | "scalar";

export interface MetricVisualizationSpec {
  mode: MetricVisualizationMode;
  period_day_keys: boolean;
}

export interface EvaluationMetricSummaryPublic {
  id: string;
  name: string;
  description: string;
  source_path: string;
  created_at: string;
  updated_at: string;
  visualization?: MetricVisualizationSpec | null;
}

export interface EvaluationMetricDetailPublic extends EvaluationMetricSummaryPublic {
  source: string;
}

export function listEvaluationMetrics(): Promise<EvaluationMetricSummaryPublic[]> {
  return apiFetchJson<EvaluationMetricSummaryPublic[]>("/evaluation-metrics");
}

export function getEvaluationMetric(
  id: string,
): Promise<EvaluationMetricDetailPublic> {
  return apiFetchJson<EvaluationMetricDetailPublic>(
    `/evaluation-metrics/${encodeURIComponent(id)}`,
  );
}

export function createEvaluationMetric(
  body: unknown,
): Promise<EvaluationMetricDetailPublic> {
  return apiFetchJson<EvaluationMetricDetailPublic>("/evaluation-metrics", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function patchEvaluationMetric(
  id: string,
  body: unknown,
): Promise<EvaluationMetricDetailPublic> {
  return apiFetchJson<EvaluationMetricDetailPublic>(
    `/evaluation-metrics/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(body) },
  );
}

export function deleteEvaluationMetric(id: string): Promise<void> {
  return apiFetchJson<void>(`/evaluation-metrics/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export interface WorkflowNodeDto {
  id: string;
  type: string;
  pos: [number, number];
  params: Record<string, unknown>;
}

export interface WorkflowLinkDto {
  id?: string | null;
  from_node: string;
  from_socket: string;
  to_node: string;
  to_socket: string;
}

export interface EvaluationWorkflowDto {
  nodes: WorkflowNodeDto[];
  links: WorkflowLinkDto[];
  viewport?: { x: number; y: number; zoom: number } | null;
}

export interface EvaluationProfilePrepareDto {
  forward_return_periods: number[];
  quantiles: number | null;
  long_short: boolean;
  max_loss: number;
}

export interface EvaluationProfilePublic {
  id: string;
  name: string;
  description: string;
  test_set_id: string | null;
  prepare: EvaluationProfilePrepareDto;
  workflow: EvaluationWorkflowDto;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface NodeTypeSocketPublic {
  name: string;
  required: boolean;
  value_type: string;
}

export interface NodeTypeDefinitionPublic {
  type: string;
  label: string;
  description: string;
  inputs: NodeTypeSocketPublic[];
  outputs: NodeTypeSocketPublic[];
  user_defined: boolean;
  metric_id: string | null;
}

export function listEvaluationProfiles(): Promise<EvaluationProfilePublic[]> {
  return apiFetchJson<EvaluationProfilePublic[]>("/evaluation-profiles");
}

export function getEvaluationProfile(
  id: string,
): Promise<EvaluationProfilePublic> {
  return apiFetchJson<EvaluationProfilePublic>(
    `/evaluation-profiles/${encodeURIComponent(id)}`,
  );
}

export function createEvaluationProfile(
  body: unknown,
): Promise<EvaluationProfilePublic> {
  return apiFetchJson<EvaluationProfilePublic>("/evaluation-profiles", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function patchEvaluationProfile(
  id: string,
  body: unknown,
): Promise<EvaluationProfilePublic> {
  return apiFetchJson<EvaluationProfilePublic>(
    `/evaluation-profiles/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(body) },
  );
}

export function deleteEvaluationProfile(id: string): Promise<void> {
  return apiFetchJson<void>(`/evaluation-profiles/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function listEvaluationNodeTypes(): Promise<NodeTypeDefinitionPublic[]> {
  return apiFetchJson<NodeTypeDefinitionPublic[]>(
    "/evaluation-profiles/node-types",
  );
}
