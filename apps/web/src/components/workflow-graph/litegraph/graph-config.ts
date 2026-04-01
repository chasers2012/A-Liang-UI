import type { LGraph } from "litegraph.js";

/**
 * Keys on `LGraph.config` used by the workflow UI (LiteGraph also reads
 * `align_to_grid` natively).
 */
export type LiteGraphExtendedConfig = {
  align_to_grid?: boolean;
  /** When true, new connections are blocked (embedded editor read-only). */
  interactionReadOnly?: boolean;
};

export function readLiteGraphExtendedConfig(
  graph: LGraph | null | undefined,
): LiteGraphExtendedConfig {
  return (graph?.config ?? {}) as LiteGraphExtendedConfig;
}
