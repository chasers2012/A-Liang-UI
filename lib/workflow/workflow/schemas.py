from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class WorkflowSocketDefinition(BaseModel):
    """通用 socket 定义，用于节点输入/输出及工作流边界端口。"""

    name: str = Field(description="Socket 名称（在节点内唯一）")
    required: bool = Field(description="是否为必填 socket")
    value_type: str = Field(
        description="值类型标识；支持逗号分隔多个类型（如 string,number,dataframe）。连线时 input/output 任意类型有交集即可连接；空字符串表示不限制类型（任意类型）。"
    )
    render_type: str | None = Field(default=None, description="前端渲染类型，如 socket、appendable")
    label: str | None = Field(default=None, description="展示名称")


class WorkflowNodeInputSpec(WorkflowSocketDefinition):
    """
    节点输入定义。

    继承自 ``WorkflowSocketDefinition``，因此 node input 既可作为普通参数项使用，
    也可作为 socket 参与工作流连线与类型匹配。
    """

    class OptionItem(BaseModel):
        """下拉选项项定义。"""

        label: str | int = Field(description="下拉选项展示文案")
        value: str | int = Field(description="下拉选项实际值")

    default: Any | None = Field(default=None, description="输入项默认值（未连线时生效）")
    options: list[str | int | OptionItem] | None = Field(
        default=None,
        description="可选值列表（支持基础值或 {label, value} 对象）",
    )
    minimum: float | None = Field(default=None, description="数值输入最小值")
    maximum: float | None = Field(default=None, description="数值输入最大值")
    rows: int | None = Field(default=None, description="textarea 渲染行数")
    json_schema: Any | None = Field(
        default=None, description="RJSF 的 JSON Schema（用于参数表单渲染）"
    )
    ui_schema: Any | None = Field(default=None, description="RJSF 的 UI Schema（用于参数表单渲染）")


class WorkflowGraphNode(BaseModel):
    """工作流中的节点实例及其输入输出定义。"""

    id: str = Field(description="节点实例 ID")
    type: str = Field(description="节点类型（后端 type_key）")
    pos: tuple[float, float] = Field(description="节点画布坐标 [x, y]")
    label: str = Field(description="节点展示名称")
    category: str | None = Field(default=None, description="节点分类")
    inputs: list[WorkflowNodeInputSpec] = Field(default_factory=list, description="节点输入定义")
    outputs: list[WorkflowSocketDefinition] = Field(
        default_factory=list, description="节点输出定义"
    )
    params: dict[str, Any] = Field(default_factory=dict, description="节点参数值")


class WorkflowGraphEndpointNode(BaseModel):
    """连线端点：节点侧端点。"""

    kind: str = Field(pattern=r"^node$", description="端点类型：node")
    node_id: str = Field(description="端点所属节点 ID")
    socket: str = Field(description="端点 socket 名称")


class WorkflowGraphEndpointInput(BaseModel):
    """连线端点：工作流输入侧端点。"""

    kind: str = Field(pattern=r"^workflow_input$", description="端点类型：workflow_input")
    socket: str = Field(description="工作流输入 socket 名称")


class WorkflowGraphEndpointOutput(BaseModel):
    """连线端点：工作流输出侧端点。"""

    kind: str = Field(pattern=r"^workflow_output$", description="端点类型：workflow_output")
    socket: str = Field(description="工作流输出 socket 名称")


class WorkflowGraphLink(BaseModel):
    """工作流连线定义，描述 from/to 两端端点。"""

    model_config = ConfigDict(populate_by_name=True)

    id: str | None = Field(default=None, description="连线 ID（可选）")
    from_: WorkflowGraphEndpointNode | WorkflowGraphEndpointInput = Field(
        alias="from",
        description="连线起点（节点输出或工作流输入）",
    )
    to: WorkflowGraphEndpointNode | WorkflowGraphEndpointOutput = Field(
        description="连线终点（节点输入或工作流输出）",
    )


class WorkflowBoundaryPositions(BaseModel):
    """工作流输入/输出边界节点在画布中的位置。"""

    input: tuple[float, float] = Field(description="工作流输入边界节点坐标 [x, y]")
    output: tuple[float, float] = Field(description="工作流输出边界节点坐标 [x, y]")


class WorkflowGraphPersisted(BaseModel):
    """持久化工作流图结构（节点、连线与边界端口定义）。"""

    nodes: list[WorkflowGraphNode] = Field(default_factory=list, description="工作流节点列表")
    links: list[WorkflowGraphLink] = Field(default_factory=list, description="工作流连线列表")
    workflow_inputs: list[WorkflowSocketDefinition] = Field(
        default_factory=list,
        description="工作流级输入 socket 定义",
    )
    workflow_outputs: list[WorkflowSocketDefinition] = Field(
        default_factory=list,
        description="工作流级输出 socket 定义",
    )
    workflow_boundary_positions: WorkflowBoundaryPositions | None = Field(
        default=None,
        description="工作流输入/输出边界节点坐标",
    )
