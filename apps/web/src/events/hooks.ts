import { useEffect } from 'react';

import { eventBus, type EventEnvelope, type EventHandler, type ReconnectHandler } from './client';

export type { EventEnvelope, EventHandler, ReconnectHandler };

/** Subscribe to a single topic for the lifetime of the component. */
export function useEventSubscription<T = unknown>(topic: string, handler: EventHandler<T>): void {
  useEffect(() => eventBus.on(topic, handler), [topic, handler]);
}

/** Run a handler whenever the SSE connection has reconnected (post-drop). */
export function useEventReconnect(handler: ReconnectHandler): void {
  useEffect(() => eventBus.onReconnect(handler), [handler]);
}
