export function readPayloadString(payload: Record<string, unknown>, key: string): string {
  const v = payload[key];
  return typeof v === 'string' ? v : '';
}

export function readPayloadIdList(payload: Record<string, unknown>, pluralKey: string, singularKey: string): string[] {
  const raw = payload[pluralKey];
  if (Array.isArray(raw) && raw.length) {
    const out = raw.map((x) => String(x).trim()).filter(Boolean);
    if (out.length) return out;
  }
  const one = readPayloadString(payload, singularKey).trim();
  return one ? [one] : [];
}
