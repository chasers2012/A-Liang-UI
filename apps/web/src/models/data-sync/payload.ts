export function readPayloadString(payload: Record<string, unknown>, key: string): string {
  const v = payload[key];
  return typeof v === 'string' ? v : '';
}

export function readPayloadIdList(payload: Record<string, unknown>, key: string): string[] {
  const raw = payload[key];
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x).trim()).filter(Boolean);
}
