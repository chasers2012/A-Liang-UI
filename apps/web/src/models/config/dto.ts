export type ConfigModuleSpecPublic = {
  key: string;
  title: string;
  description: string | null;
  schema: Record<string, unknown>;
  uiSchema: Record<string, unknown>;
};

export type ConfigSpecsResponse = {
  items: ConfigModuleSpecPublic[];
};

export type ConfigValuesResponse = {
  module_key: string;
  values: Record<string, unknown>;
};
