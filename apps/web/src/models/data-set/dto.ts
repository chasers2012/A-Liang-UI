/** 数据集 DTO（与后端 `/data-sets` API 契约一致）。 */

import type { WorkflowGraphPersisted } from '@/components/workflow-graph/reactflow/types';

export interface DataSetDatasourceBindingPublic {
  datasource_id: string;
  datasource_name: string;
  datasource_type: string;
  columns: string[];
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
  preprocessing_workflow: WorkflowGraphPersisted;
  start: string;
  end: string;
  instrument_codes: string[];
  created_at: string;
  updated_at: string;
}
