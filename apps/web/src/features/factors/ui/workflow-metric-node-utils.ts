/** 评价工作流中「指标」类节点（内置 + 用户 registry）的 type 判断与 id 解析。 */

export const USER_METRIC_PREFIX = "user_metric_";

export function isRegistryOrBuiltinMetricNodeType(
  nodeType: string | undefined,
): boolean {
  if (!nodeType) return false;
  if (nodeType.startsWith(USER_METRIC_PREFIX)) return true;
  return (
    nodeType === "builtin_mean_ic" ||
    nodeType === "builtin_mean_return_spread"
  );
}

/** UUID registry id encoded in ``user_metric_<8>_<4>_...`` node type. */
export function registryMetricIdFromWorkflowType(
  nodeType: string | undefined,
): string | null {
  if (!nodeType?.startsWith(USER_METRIC_PREFIX)) return null;
  const tail = nodeType.slice(USER_METRIC_PREFIX.length);
  const parts = tail.split("_");
  if (parts.length !== 5) return null;
  const [a, b, c, d, e] = parts;
  if (
    a?.length !== 8 ||
    b?.length !== 4 ||
    c?.length !== 4 ||
    d?.length !== 4 ||
    e?.length !== 12
  ) {
    return null;
  }
  return `${a}-${b}-${c}-${d}-${e}`;
}
