/** 评价用测试集 DTO。 */

export interface EvaluationTestSetDatasourceBindingPublic {
  datasource_id: string;
  datasource_name: string;
  datasource_type: string;
  dependencies: string[];
}

export interface EvaluationTestSetPublic {
  id: string;
  name: string;
  description: string;
  datasource_bindings: EvaluationTestSetDatasourceBindingPublic[];
  start: string;
  end: string;
  stock_codes: string[];
  is_default: boolean;
  created_at: string;
  updated_at: string;
}
