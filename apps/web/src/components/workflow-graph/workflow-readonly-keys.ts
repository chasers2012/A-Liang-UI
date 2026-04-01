export function shouldBlockProcessKeyInWorkflowReadOnly(e: KeyboardEvent): boolean {
  if (e.keyCode === 46 || e.keyCode === 8) return true;
  if (e.ctrlKey || e.metaKey) {
    const k = e.keyCode;
    if (k === 65 || k === 67 || k === 86 || k === 88) return true;
  }
  return false;
}
