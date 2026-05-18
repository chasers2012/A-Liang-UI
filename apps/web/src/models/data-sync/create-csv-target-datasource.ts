import { createDatasource, inspectDatasourceColumns } from '@/api/datasources';
import type { DataSourcePublic, InspectColumnsResponseBody } from '@/models/datasource/dto';

export type CsvTargetColumnSpec = {
  columns: string[];
  dateColumn: string;
  assetColumn: string | null;
};

function mergeUniqueColumnNames(responses: InspectColumnsResponseBody[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const resp of responses) {
    for (const raw of resp.columns ?? []) {
      const name = String(raw).trim();
      if (!name || seen.has(name)) continue;
      seen.add(name);
      out.push(name);
    }
  }
  return out;
}

/** 从已选源数据源探测列名，并推断日期列 / 资产列（多源时合并列名，日期/资产取首个源）。 */
export async function resolveSourceColumnsForCsvTarget(sourceIds: string[]): Promise<CsvTargetColumnSpec> {
  const ids = sourceIds.map((x) => x.trim()).filter(Boolean);
  if (ids.length === 0) {
    throw new Error('请先选择源数据源。');
  }

  const inspections = await Promise.all(ids.map((id) => inspectDatasourceColumns({ datasource_id: id })));
  const columns = mergeUniqueColumnNames(inspections);
  if (columns.length === 0) {
    throw new Error('无法从源数据源读取列名，请确认源已配置且可访问。');
  }

  const first = inspections[0];
  return {
    columns,
    dateColumn: first.date_column,
    assetColumn: first.asset_column,
  };
}

export function buildCsvTargetDatasourceCreateBody(args: {
  name: string;
  columns: string[];
  dateColumn: string;
  assetColumn: string | null;
}): {
  name: string;
  type: string;
  connection_config: Record<string, unknown>;
  columns_config: Record<string, unknown>;
  write_config: Record<string, unknown>;
} {
  const trimmedName = args.name.trim();
  return {
    name: trimmedName,
    type: 'csv',
    connection_config: {
      create_if_missing: true,
      initial_columns: args.columns,
    },
    columns_config: {
      date_column: args.dateColumn,
      asset_column: args.assetColumn,
      columns: args.columns,
    },
    write_config: {
      write_enabled: true,
    },
  };
}

export async function createCsvTargetDatasourceFromSources(args: {
  name: string;
  sourceIds: string[];
}): Promise<DataSourcePublic> {
  const trimmedName = args.name.trim();
  if (!trimmedName) {
    throw new Error('请填写数据源名称。');
  }
  const spec = await resolveSourceColumnsForCsvTarget(args.sourceIds);
  return await createDatasource(
    buildCsvTargetDatasourceCreateBody({
      name: trimmedName,
      ...spec,
    }),
  );
}
