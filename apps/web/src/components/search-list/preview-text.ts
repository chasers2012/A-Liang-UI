function toPlainTextPreview(input?: string | null, maxLength = 120): string {
  if (!input) return '';
  const plain = input
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^>\s?/gm, '')
    .replace(/[#_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (plain.length <= maxLength) return plain;
  return `${plain.slice(0, maxLength)}...`;
}

/** 列表摘要：只取描述中第一个非空行，再作纯文本预览。 */
export function toPlainTextFirstLinePreview(input?: string | null, maxLength = 120): string {
  if (!input) return '';
  let first = '';
  for (const line of input.split(/\r?\n/)) {
    const t = line.trim();
    if (t) {
      first = t;
      break;
    }
  }
  return toPlainTextPreview(first, maxLength);
}
