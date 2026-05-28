import { useSyncExternalStore } from 'react';

/** 仅在客户端 hydration 完成后为 true；SSR 与 hydration 首屏均为 false，避免与服务端 HTML 不一致。 */
export function useHydrated() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
