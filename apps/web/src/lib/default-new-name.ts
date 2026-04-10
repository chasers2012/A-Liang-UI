function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatTimestamp(d: Date): string {
  const y = d.getFullYear();
  const mo = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  const h = pad2(d.getHours());
  const mi = pad2(d.getMinutes());
  const s = pad2(d.getSeconds());
  return `${y}${mo}${day}_${h}${mi}${s}`;
}

export function defaultNewName(prefix: string, d = new Date()): string {
  return `${prefix}_${formatTimestamp(d)}`;
}
