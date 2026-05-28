function parseValueTypes(valueType: string | null | undefined): Set<string> {
  return new Set(
    String(valueType ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

export function isValueTypeCompatible(
  fromValueType: string | null | undefined,
  toValueType: string | null | undefined,
): boolean {
  const fromTypes = parseValueTypes(fromValueType);
  const toTypes = parseValueTypes(toValueType);

  // 任一侧未声明类型时，视为可连接。
  if (fromTypes.size === 0 || toTypes.size === 0) return true;

  for (const t of fromTypes) {
    if (toTypes.has(t)) return true;
  }
  return false;
}
