export const APPENDABLE_HANDLE_MARKER = '__appendable__';

export function appendableHandleId(baseName: string, slotIndex: number): string {
  return `${baseName}${APPENDABLE_HANDLE_MARKER}${slotIndex}`;
}

export function appendableHandleBase(handle: string): string {
  const idx = handle.indexOf(APPENDABLE_HANDLE_MARKER);
  return idx >= 0 ? handle.slice(0, idx) : handle;
}

export function normalizeAppendableHandle(handle: string): string {
  return appendableHandleBase(handle);
}

/** 用于对指向同一 appendable 端口的连线排序（与 `appendableHandleId` 的槽位序号一致）。 */
export function appendableSlotSortKey(handle: string): number {
  const base = appendableHandleBase(handle);
  if (handle === base) {
    return 1;
  }
  const idx = handle.indexOf(APPENDABLE_HANDLE_MARKER);
  if (idx < 0) {
    return 1;
  }
  const n = Number.parseInt(handle.slice(idx + APPENDABLE_HANDLE_MARKER.length), 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}
