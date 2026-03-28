import type { DataSourcePublic } from "@/lib/quant-agent-api";

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

export function datasourceSummary(ds: DataSourcePublic): string {
  if (ds.type === "sql" && ds.sql) {
    const s = ds.sql;
    const host = s.db_host.trim() ? truncate(s.db_host, 24) : "—";
    return `${host} · ${s.table}`;
  }
  if (ds.type === "csv" && ds.csv) return truncate(ds.csv.path, 48);
  return "—";
}
