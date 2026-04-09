import type { DataSourcePublic } from "@/lib/quant-agent-api";

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

export function datasourceSummary(ds: DataSourcePublic): string {
  const cfg = ds.config ?? {};
  if (typeof cfg.path === "string" && cfg.path.trim()) {
    return truncate(cfg.path.trim(), 48);
  }
  const host = typeof cfg.db_host === "string" ? cfg.db_host.trim() : "";
  const table = typeof cfg.table === "string" ? cfg.table.trim() : "";
  if (host || table) {
    return `${host || "—"} · ${table || "—"}`;
  }
  return `type=${ds.type}`;
}
