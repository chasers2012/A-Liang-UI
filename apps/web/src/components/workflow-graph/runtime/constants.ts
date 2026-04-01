export const LITEGRAPH_WORKFLOW_STEP_TYPE = "workflow_graph/step";

/** 写入 `serialize().extra` 的版本号，便于未来迁移。 */
export const WORKFLOW_GRAPH_EXTRA_SCHEMA_VERSION = 1;

/** 空图（LiteGraph `configure` 可接受的最小结构）。 */
export const EMPTY_LITEGRAPH_GRAPH_JSON = '{"nodes":[],"links":[]}';
