import { getQuantAgentApiBase } from '@/api/client';

/** Wire payload mirroring ``app.events.schemas.EventEnvelope``. */
export interface EventEnvelope<T = unknown> {
  id: number;
  topic: string;
  ts: string;
  data: T;
}

export type EventHandler<T = unknown> = (envelope: EventEnvelope<T>) => void;
export type ReconnectHandler = () => void;

/**
 * Singleton client wrapping the browser EventSource against ``GET /events``.
 *
 * - One process-wide connection (HTTP/1.1 cap is per-origin, so we keep this
 *   to a single long-lived connection).
 * - Subscribers register per ``topic``; ``addEventListener(topic, ...)`` is
 *   attached lazily the first time a topic gets a subscriber.
 * - Browser ``EventSource`` reconnects automatically; the first ``open`` is
 *   ignored, subsequent ``open`` events trigger ``reconnectHandlers`` so
 *   business modules can re-fetch state to re-align with the server.
 */
class EventBusClient {
  private es: EventSource | null = null;
  private connectCount = 0;
  private readonly handlers = new Map<string, Set<EventHandler>>();
  private readonly topicsBound = new Set<string>();
  private readonly reconnectHandlers = new Set<ReconnectHandler>();

  connect(): void {
    if (typeof window === 'undefined') return;
    if (this.es) return;
    const url = `${getQuantAgentApiBase()}/events`;
    const es = new EventSource(url);
    this.es = es;
    es.addEventListener('open', () => {
      this.connectCount += 1;
      if (this.connectCount > 1) {
        for (const h of this.reconnectHandlers) {
          try {
            h();
          } catch (err) {
            console.error('[event-bus] reconnect handler error', err);
          }
        }
      }
    });
    es.addEventListener('error', () => {
      // EventSource will auto-reconnect; nothing to do here.
    });
    for (const topic of this.topicsBound) {
      es.addEventListener(topic, this.makeTopicListener(topic));
    }
  }

  disconnect(): void {
    if (!this.es) return;
    this.es.close();
    this.es = null;
    this.connectCount = 0;
  }

  on<T = unknown>(topic: string, handler: EventHandler<T>): () => void {
    let set = this.handlers.get(topic);
    if (!set) {
      set = new Set();
      this.handlers.set(topic, set);
    }
    set.add(handler as EventHandler);
    this.bindTopic(topic);
    return () => {
      const existing = this.handlers.get(topic);
      if (!existing) return;
      existing.delete(handler as EventHandler);
      if (existing.size === 0) this.handlers.delete(topic);
    };
  }

  onReconnect(handler: ReconnectHandler): () => void {
    this.reconnectHandlers.add(handler);
    return () => {
      this.reconnectHandlers.delete(handler);
    };
  }

  private bindTopic(topic: string): void {
    if (this.topicsBound.has(topic)) return;
    this.topicsBound.add(topic);
    if (this.es) {
      this.es.addEventListener(topic, this.makeTopicListener(topic));
    }
  }

  private makeTopicListener(topic: string): (event: MessageEvent) => void {
    return (event: MessageEvent) => {
      const handlers = this.handlers.get(topic);
      if (!handlers || handlers.size === 0) return;
      let envelope: EventEnvelope | null = null;
      try {
        envelope = JSON.parse(event.data) as EventEnvelope;
      } catch (err) {
        console.warn('[event-bus] invalid payload for topic', topic, err);
        return;
      }
      for (const h of handlers) {
        try {
          h(envelope);
        } catch (err) {
          console.error('[event-bus] handler error', topic, err);
        }
      }
    };
  }
}

export const eventBus = new EventBusClient();
