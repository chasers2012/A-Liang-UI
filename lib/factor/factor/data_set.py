from factor.datasource import FactorDataSource
from factor.dependency_resolver import DependencyResolver


class DataSourceBinding:
    datasource: FactorDataSource
    dependencies: list[str]
    alias: dict[str, str] | None = None

    def __init__(
        self,
        datasource: FactorDataSource,
        dependencies: list[str] | None = None,
        alias: dict[str, str] | None = None,
    ):
        self.datasource = datasource
        self.dependencies = list(dependencies or [])
        self.alias = alias


class DataSet:
    data_source_bindings: list[DataSourceBinding]

    def __init__(self, data_source_bindings: list[DataSourceBinding]):
        self.data_source_bindings = data_source_bindings

    def create_resolver(self) -> DependencyResolver:
        resolver = DependencyResolver()
        for data_binding in self.data_source_bindings:
            resolver.register_datasource(
                data_binding.datasource, data_binding.dependencies, data_binding.alias
            )
        return resolver
