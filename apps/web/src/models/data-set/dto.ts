/** 数据集 DTO（与后端 `/data-sets` API 契约一致）。 */

export interface DataSetDatasourceBindingPublic {
  datasource_id: string;
  datasource_name: string;
  datasource_type: string;
  dependencies: string[];
}

export interface DataSetPublic {
  id: string;
  name: string;
  description: string;
  datasource_bindings: DataSetDatasourceBindingPublic[];
  start: string;
  end: string;
  stock_codes: string[];
  is_default: boolean;
  created_at: string;
  updated_at: string;
}
