function isRecord(x: unknown): x is Record<string, unknown> {
  return Boolean(x) && typeof x === 'object' && !Array.isArray(x);
}

function asEquitySeries(equityCurve: Array<Record<string, unknown>>): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const row of equityCurve) {
    const tRaw = row['date'] ?? row['index'] ?? row['datetime'] ?? row['timestamp'] ?? row['t'];
    const vRaw = row['value'] ?? row['equity'] ?? row['v'];
    const t = typeof tRaw === 'string' ? Date.parse(tRaw) : Number(tRaw);
    const v = Number(vRaw);
    if (!Number.isFinite(t) || !Number.isFinite(v)) continue;
    out.push([t, v]);
  }
  return out;
}

function fmtValue(v: unknown): string {
  if (v == null) return '-';
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return String(v);
    const abs = Math.abs(v);
    if (abs >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 4 });
    return v.toLocaleString(undefined, { maximumFractionDigits: 6 });
  }
  if (typeof v === 'string') return v;
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return String(v);
}

function asStatsEntries(stats: unknown): Array<{ key: string; value: unknown }> {
  if (!stats) return [];
  if (Array.isArray(stats)) {
    const out: Array<{ key: string; value: unknown }> = [];
    for (const row of stats) {
      if (!isRecord(row)) continue;
      const keyRaw = row['index'] ?? row['metric'] ?? row['name'] ?? row['key'];
      const valRaw = row['value'];
      if (keyRaw == null) continue;
      out.push({ key: String(keyRaw), value: valRaw });
    }
    return out;
  }
  if (isRecord(stats)) {
    return Object.entries(stats).map(([key, value]) => ({ key, value }));
  }
  return [];
}

function asTradeRows(trades: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(trades)) return [];
  return trades.filter((x): x is Record<string, unknown> => isRecord(x));
}

export { asEquitySeries, asStatsEntries, asTradeRows, fmtValue, isRecord };
