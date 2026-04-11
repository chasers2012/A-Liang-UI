import type { NodeParamModel } from "@/models/evaluation-metric/dto";

import type { WorkflowNodeInputSpec } from "./types";

/** 后端 ``Socket.serialize()`` 无 ``default``；``NodeParam`` 序列化含 ``default``。 */
export function isWireInputSpec(s: WorkflowNodeInputSpec): boolean {
  // socket / appendable 都是连线端口；其余 render_type 才是内联参数。
  return (
    !s.render_type ||
    s.render_type === "socket" ||
    s.render_type === "appendable"
  );
}

export function inputSpecToNodeParamModel(
  s: WorkflowNodeInputSpec,
): NodeParamModel {
  return {
    key: s.name,
    label: (s.label ?? "").trim() || s.name,
    description: s.description ?? undefined,
    type: s.value_type,
    default: s.default as NodeParamModel["default"],
    minimum: s.minimum ?? undefined,
    maximum: s.maximum ?? undefined,
    render_type: s.render_type ?? undefined,
    options: s.options ?? undefined,
  };
}
