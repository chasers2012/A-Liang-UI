import type {
  AgentChatRequestPublic,
  AgentChatSessionCreateBody,
  AgentChatSessionDetailPublic,
  AgentChatSessionRenameBody,
  AgentChatSessionSummaryPublic,
  AgentLlmSettingsPublic,
  AgentNodeTypePublic,
  AgentWorkflowDetailPublic,
  AgentWorkflowSummaryPublic,
  DataSourcePublic,
  EvaluationMetricDetailPublic,
  EvaluationMetricSummaryPublic,
  EvaluationProfilePublic,
  DataSetPublic,
  FactorDetailPublic,
  FactorEvaluationRowPublic,
  FactorEvaluationsSummaryPublic,
  FactorSummaryPublic,
  EvaluationNodeTypeCatalogItemPublic,
  SqlTableColumnsRequestBody,
  SqlTableColumnsResponseBody,
  TestResult,
} from "@/models";

/** Base URL for quant-agent FastAPI (no trailing slash). */
export function getQuantAgentApiBase(): string {
  const raw =
    process.env.NEXT_PUBLIC_QUANT_AGENT_API ?? "http://127.0.0.1:8000";
  return raw.replace(/\/$/, "");
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

export function getAgentLlmSettings(): Promise<AgentLlmSettingsPublic> {
  return apiFetchJson<AgentLlmSettingsPublic>("/agent/llm-settings");
}

export function putAgentLlmSettings(
  body: AgentLlmSettingsPublic,
): Promise<AgentLlmSettingsPublic> {
  return apiFetchJson<AgentLlmSettingsPublic>("/agent/llm-settings", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

type AgentChatSseParsed =
  | { kind: "delta"; text: string }
  | { kind: "done" }
  | { kind: "error"; message: string }
  | {
      kind: "tool_start";
      payload: { name: string; id: string; args?: unknown };
    }
  | {
      kind: "tool_result";
      payload: { name: string; id: string; result: unknown };
    }
  | {
      kind: "tool_error";
      payload: { name: string; id: string; error: string };
    }
  | { kind: "skip" };

function sseStringField(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function parseAgentChatSsePayloadObject(
  o: Record<string, unknown>,
): AgentChatSseParsed {
  if (typeof o.error === "string") return { kind: "error", message: o.error };
  if (o.done === true) return { kind: "done" };
  if (typeof o.delta === "string" && o.delta.length > 0) {
    return { kind: "delta", text: o.delta };
  }
  const ts = o.tool_start;
  if (ts && typeof ts === "object") {
    const p = ts as Record<string, unknown>;
    return {
      kind: "tool_start",
      payload: {
        name: sseStringField(p.name),
        id: sseStringField(p.id),
        args: p.args,
      },
    };
  }
  const tr = o.tool_result;
  if (tr && typeof tr === "object") {
    const p = tr as Record<string, unknown>;
    return {
      kind: "tool_result",
      payload: {
        name: sseStringField(p.name),
        id: sseStringField(p.id),
        result: p.result,
      },
    };
  }
  const te = o.tool_error;
  if (te && typeof te === "object") {
    const p = te as Record<string, unknown>;
    return {
      kind: "tool_error",
      payload: {
        name: sseStringField(p.name),
        id: sseStringField(p.id),
        error:
          typeof p.error === "string" ? p.error : String(p.error ?? ""),
      },
    };
  }
  return { kind: "skip" };
}

function parseAgentChatSseBlock(block: string): AgentChatSseParsed {
  const dataLines = block
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.replace(/^data:\s?/, "").trim());
  if (dataLines.length === 0) return { kind: "skip" };
  const payload = dataLines.join("\n");
  if (!payload) return { kind: "skip" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return { kind: "skip" };
  }
  if (typeof parsed !== "object" || parsed === null) return { kind: "skip" };
  return parseAgentChatSsePayloadObject(parsed as Record<string, unknown>);
}

export type AgentChatStreamOptions = {
  onDelta: (text: string) => void;
  onToolStart?: (payload: {
    name: string;
    id: string;
    args?: unknown;
  }) => void;
  onToolResult?: (payload: {
    name: string;
    id: string;
    result: unknown;
  }) => void;
  onToolError?: (payload: {
    name: string;
    id: string;
    error: string;
  }) => void;
};

/**
 * POST ``/agent/chat/stream`` (SSE). Invokes ``onDelta`` for each text chunk; optional tool callbacks; throws ``ApiError`` on HTTP or stream ``error`` events.
 */
function handleParsedAgentChatSseEvent(
  ev: AgentChatSseParsed,
  options: AgentChatStreamOptions,
): "continue" | "done" | "throw" {
  if (ev.kind === "skip") return "continue";
  if (ev.kind === "error") throw new ApiError(ev.message, 502);
  if (ev.kind === "done") return "done";
  if (ev.kind === "delta") {
    options.onDelta(ev.text);
    return "continue";
  }
  if (ev.kind === "tool_start") {
    options.onToolStart?.(ev.payload);
    return "continue";
  }
  if (ev.kind === "tool_result") {
    options.onToolResult?.(ev.payload);
    return "continue";
  }
  options.onToolError?.(ev.payload);
  return "continue";
}

export async function postAgentChatStream(
  body: AgentChatRequestPublic,
  options: AgentChatStreamOptions,
): Promise<void> {
  const url = `${getQuantAgentApiBase()}/agent/chat/stream`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(parseDetail(text), res.status);
  }
  const reader = res.body?.getReader();
  if (!reader) {
    throw new ApiError("响应无正文", res.status || 502);
  }
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    for (;;) {
      const sep = buffer.indexOf("\n\n");
      if (sep === -1) break;
      const block = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const ev = parseAgentChatSseBlock(block);
      const action = handleParsedAgentChatSseEvent(ev, options);
      if (action === "done") return;
    }
  }
}

export function listAgentChatSessions(): Promise<AgentChatSessionSummaryPublic[]> {
  return apiFetchJson<AgentChatSessionSummaryPublic[]>("/agent/chat/sessions");
}

export function createAgentChatSession(
  body: AgentChatSessionCreateBody,
): Promise<AgentChatSessionDetailPublic> {
  return apiFetchJson<AgentChatSessionDetailPublic>("/agent/chat/sessions", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getAgentChatSession(
  id: string,
): Promise<AgentChatSessionDetailPublic> {
  return apiFetchJson<AgentChatSessionDetailPublic>(
    `/agent/chat/sessions/${encodeURIComponent(id)}`,
  );
}

export function renameAgentChatSession(
  id: string,
  body: AgentChatSessionRenameBody,
): Promise<AgentChatSessionDetailPublic> {
  return apiFetchJson<AgentChatSessionDetailPublic>(
    `/agent/chat/sessions/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    },
  );
}

export function archiveAgentChatSession(id: string): Promise<void> {
  return apiFetchJson<void>(`/agent/chat/sessions/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function listAgentWorkflows(): Promise<AgentWorkflowSummaryPublic[]> {
  return apiFetchJson<AgentWorkflowSummaryPublic[]>("/agent/workflows");
}

export function getAgentWorkflow(
  id: string,
): Promise<AgentWorkflowDetailPublic> {
  return apiFetchJson<AgentWorkflowDetailPublic>(
    `/agent/workflows/${encodeURIComponent(id)}`,
  );
}

export function createAgentWorkflow(
  body: unknown,
): Promise<AgentWorkflowDetailPublic> {
  return apiFetchJson<AgentWorkflowDetailPublic>("/agent/workflows", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function patchAgentWorkflow(
  id: string,
  body: unknown,
): Promise<AgentWorkflowDetailPublic> {
  return apiFetchJson<AgentWorkflowDetailPublic>(
    `/agent/workflows/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(body) },
  );
}

export function deleteAgentWorkflow(id: string): Promise<void> {
  return apiFetchJson<void>(`/agent/workflows/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function listAgentWorkflowNodeTypes(): Promise<AgentNodeTypePublic[]> {
  return apiFetchJson<AgentNodeTypePublic[]>("/agent/workflows/node-types");
}

export function listDatasources(): Promise<DataSourcePublic[]> {
  return apiFetchJson<DataSourcePublic[]>("/datasources");
}

export function getDatasource(id: string): Promise<DataSourcePublic> {
  return apiFetchJson<DataSourcePublic>(
    `/datasources/${encodeURIComponent(id)}`,
  );
}

/** 因子依赖字段名：SQL 为 column_map 键；CSV 为文件表头（不含日期/资产列） */
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

export function listFactors(): Promise<FactorSummaryPublic[]> {
  return apiFetchJson<FactorSummaryPublic[]>("/factors");
}

export function getFactor(id: string): Promise<FactorDetailPublic> {
  return apiFetchJson<FactorDetailPublic>(`/factors/${encodeURIComponent(id)}`);
}

export function getFactorTemplate(): Promise<string> {
  return apiFetchJson<string>(`/factors/template`);
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

export function getFactorEvaluationsSummary(): Promise<FactorEvaluationsSummaryPublic> {
  return apiFetchJson<FactorEvaluationsSummaryPublic>(
    "/factors/evaluations/summary",
  );
}

export function listDataSets(): Promise<DataSetPublic[]> {
  return apiFetchJson<DataSetPublic[]>("/data-sets");
}

export function getDataSet(id: string): Promise<DataSetPublic> {
  return apiFetchJson<DataSetPublic>(`/data-sets/${encodeURIComponent(id)}`);
}

export function createDataSet(body: unknown): Promise<DataSetPublic> {
  return apiFetchJson<DataSetPublic>("/data-sets", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function patchDataSet(
  id: string,
  body: unknown,
): Promise<DataSetPublic> {
  return apiFetchJson<DataSetPublic>(`/data-sets/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteDataSet(id: string): Promise<void> {
  return apiFetchJson<void>(`/data-sets/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function runFactorEvaluation(
  factorId: string,
  options: {
    dataSetId?: string | null;
    evaluationProfileId: string;
  },
): Promise<FactorEvaluationRowPublic> {
  const profileId = options.evaluationProfileId.trim();
  if (!profileId) {
    return Promise.reject(new Error("evaluationProfileId is required"));
  }
  const init: RequestInit = { method: "POST" };
  if (options.dataSetId != null) {
    init.body = JSON.stringify({
      data_set_id: options.dataSetId,
    });
  }
  return apiFetchJson<FactorEvaluationRowPublic>(
    `/evaluation-profiles/${encodeURIComponent(profileId)}/factors/${encodeURIComponent(factorId)}/evaluations/run`,
    init,
  );
}

export function listEvaluationMetrics(): Promise<
  EvaluationMetricSummaryPublic[]
> {
  return apiFetchJson<EvaluationMetricSummaryPublic[]>("/evaluation-metrics");
}

export function getEvaluationMetric(
  id: string,
): Promise<EvaluationMetricDetailPublic> {
  return apiFetchJson<EvaluationMetricDetailPublic>(
    `/evaluation-metrics/${encodeURIComponent(id)}`,
  );
}

export function getEvaluationMetricTemplate(): Promise<string> {
  return apiFetchJson<string>("/evaluation-metrics/template");
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

export function listEvaluationNodeTypes(): Promise<
  EvaluationNodeTypeCatalogItemPublic[]
> {
  return apiFetchJson<EvaluationNodeTypeCatalogItemPublic[]>(
    "/evaluation-profiles/node-types",
  );
}

/** 领域 DTO：也可从 `@/models` 直接引用。 */
export type * from "@/models";
