from app.data_set.controller import get_data_set
from app.data_set.redistry import DataSetsStore
from factor.data_set import DataSet
from workflow import Socket, workflow_node
from workflow.node_types import OptionsNodeParam


@workflow_node(
    input_sockets=[
        OptionsNodeParam(
            name="data_set_id",
            value_type="string",
            label="数据集",
            description="选择要加载的数据集 ID",
            options=lambda: [{"label": s.name, "value": s.id} for s in DataSetsStore.list_items()],
        ),
    ],
    output_sockets=[
        Socket(
            name="data_set",
            value_type="data_set",
            label="数据集",
            description="加载完成后的 DataSet 实例",
        ),
    ],
    label="加载数据集",
    description="根据数据集 ID 从存储中加载 DataSet 对象",
    category="common",
)
class LoadDataSet:
    def execute(self, **kwargs) -> DataSet:
        data_set_id = kwargs.get("data_set_id")
        if not isinstance(data_set_id, str) or not data_set_id.strip():
            raise ValueError("数据集 参数不能为空")
        data_set = get_data_set(data_set_id)
        if data_set is None:
            raise ValueError(f"数据集 {data_set_id} 不存在")
        return data_set
