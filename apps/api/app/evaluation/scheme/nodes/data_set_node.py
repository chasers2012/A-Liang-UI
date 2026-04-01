from app.data_set.data_set_schemas import DataSetRecord
from app.data_set.data_sets_store import DataSetsStore
from evaluate.data_set import DataSet, DataSourceBinding
from workflow import Socket, workflow_node
from workflow.node_types import OptionsNodeParam


@workflow_node(
    input_sockets=[
        OptionsNodeParam(
            name="data_set",
            label="数据集",
            default=None,
        ),
    ],
    output_sockets=[
        Socket(name="data_set", value_type="data_set"),
    ],
)
class LoadDataSet:
    def _load_data_set_by_id(self, data_set_id: str) -> DataSet:
        data_set_rec: DataSetRecord | None = DataSetsStore.get_item(data_set_id)
        if data_set_rec is None:
            raise ValueError(f"数据集 {data_set_id!r} 不存在")
        data_source_bindings = [
            DataSourceBinding(
                datasource_id=binding.datasource_id, dependencies=binding.dependencies
            )
            for binding in data_set_rec.datasource_bindings
        ]
        return DataSet(data_source_bindings=data_source_bindings)

    def execute(self, **kwargs) -> DataSet:
        data_set_id = kwargs.get("data_set")
        if not isinstance(data_set_id, str) or not data_set_id.strip():
            raise ValueError("data_set 参数不能为空")
        return self._load_data_set_by_id(data_set_id)
