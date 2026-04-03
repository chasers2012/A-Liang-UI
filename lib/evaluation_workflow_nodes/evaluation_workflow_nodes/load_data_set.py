from app.data_set.data_sets_store import DataSetsStore
from evaluate.data_set import DataSet
from workflow import Socket, workflow_node
from workflow.node_types import OptionsNodeParam


@workflow_node(
    input_sockets=[
        OptionsNodeParam(
            name="data_set",
            label="数据集",
            options=lambda: [{
                "label": s.name,
                "value": s.id
            } for s in DataSetsStore.list_items()],
        ),
    ],
    output_sockets=[
        Socket(name="data_set", value_type="data_set", label="数据集"),
    ],
    label="加载数据集",
)
class LoadDataSet:

    def execute(self, **kwargs) -> DataSet:
        print("正在加载数据集")
        print(kwargs)
        data_set_id = kwargs.get("data_set")
        if not isinstance(data_set_id, str) or not data_set_id.strip():
            raise ValueError("data_set 参数不能为空")
        return DataSetsStore.get_data_set(data_set_id)
