from __future__ import annotations

from workflow.schemas import WorkflowGraphNode, WorkflowGraphPersisted


def _is_connected_input(workflow: WorkflowGraphPersisted, node_id: str, socket_name: str) -> bool:
    return any(
        link.to.kind == "node" and link.to.node_id == node_id and link.to.socket == socket_name
        for link in workflow.links
    )


def _is_connected_workflow_output(workflow: WorkflowGraphPersisted, socket_name: str) -> bool:
    return any(
        link.to.kind == "workflow_output" and link.to.socket == socket_name
        for link in workflow.links
    )


def _collect_required_node_input_errors(
    workflow: WorkflowGraphPersisted, node: WorkflowGraphNode
) -> list[str]:
    errors: list[str] = []
    params = node.params or {}
    for input_spec in node.inputs:
        if not input_spec.required:
            continue

        render_type = (input_spec.render_type or "socket").strip()
        if render_type in {"socket", "appendable"}:
            if not _is_connected_input(workflow, node.id, input_spec.name):
                errors.append(f"节点 {node.label}({node.id}) 的必填输入 {input_spec.name} 未连接")
            continue

        has_param_value = input_spec.name in params and params[input_spec.name] is not None
        if has_param_value or input_spec.default is not None:
            continue
        errors.append(f"节点 {node.label}({node.id}) 的必填参数 {input_spec.name} 未传值")
    return errors


def validate_required_workflow_fields(workflow: WorkflowGraphPersisted | None) -> None:
    if workflow is None:
        return

    errors: list[str] = []
    for node in workflow.nodes:
        errors.extend(_collect_required_node_input_errors(workflow, node))

    for output_spec in workflow.workflow_outputs:
        if output_spec.required and not _is_connected_workflow_output(workflow, output_spec.name):
            errors.append(f"工作流必填输出 {output_spec.name} 未连接")

    if errors:
        raise ValueError("workflow 校验失败: " + "；".join(errors))
