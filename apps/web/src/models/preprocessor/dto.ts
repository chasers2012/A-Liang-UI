export interface PreprocessorSummaryPublic {
  id: string;
  name: string;
  description: string;
  source_path: string;
  created_at: string;
  updated_at: string;
}

export interface PreprocessorDetailPublic extends PreprocessorSummaryPublic {
  source: string;
}

export interface DataSetPreprocessorBindingStored {
  preprocessor_id: string;
  config?: Record<string, unknown> | null;
  datasource_ids: string[];
}
