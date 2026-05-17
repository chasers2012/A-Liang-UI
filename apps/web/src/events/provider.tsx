'use client';

import { useEffect, type PropsWithChildren } from 'react';

import { eventBus } from './client';

/** Mount once near the app root to keep the global SSE connection alive. */
export function EventBusProvider({ children }: PropsWithChildren) {
  useEffect(() => {
    eventBus.connect();
    return () => eventBus.disconnect();
  }, []);
  return <>{children}</>;
}
