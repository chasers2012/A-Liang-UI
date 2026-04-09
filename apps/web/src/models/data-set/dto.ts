/** 数据集 DTO（与后端 `/data-sets` API 契约一致）。 */

export interface DataSetDatasourceBindingPublic {
  datasource_id: string;
  datasource_name: string;
  datasource_type: string;
  dependencies: string[];
  /** 字段别名映射（逻辑字段 -> 物理列名），可选 */
  alias?: Record<string, string> | null;
  /** 日期列（物理列名） */
  date_column: string;
  /** 资产列（物理列名） */
  asset_column: string;
}

export interface DataSetPublic {
  id: string;
  name: string;
  description: string;
  datasource_bindings: DataSetDatasourceBindingPublic[];
  start: string;
  end: string;
  instrument_codes: string[];
  created_at: string;
  updated_at: string;
}
