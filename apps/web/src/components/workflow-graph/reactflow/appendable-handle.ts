export const APPENDABLE_HANDLE_MARKER = "__appendable__";

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

