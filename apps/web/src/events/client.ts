import { getQuantAgentApiBase } from '@/api/client';

export type EventHandler<T = unknown> = (data: T) => void;

/** Client-only SSE connection lifecycle topics (not from the server). */
export const CONNECTION = {
  CONNECTED: '$connected',
  CLOSED: '$closed',
  ERROR: '$error',
} as const;

/** SSE wire payload (``app.events.schemas.EventEnvelope``); only used when parsing. */
interface WireEnvelope {
  id: number;
  topic: string;
  ts: string;
  data: unknown;
}

function isPseudoTopic(topic: string): boolean {
  return topic.startsWith('$');
}

/**
 * Singleton SSE client for ``GET /events``.
 *
 * - Lazy-connects on the first ``on`` call.
 * - Business topics map to ``EventSource.addEventListener(topic, ...)``.
 * - ``$*`` topics are client-only connection lifecycle signals.
 */
class EventBusClient {
  private es: EventSource | null = null;
  private connectCount = 0;
  private readonly handlers = new Map<string, Set<EventHandler>>();
  private readonly topicsBound = new Set<string>();

  on<T>(topic: string, handler: EventHandler<T>): () => void {
    this.ensureConnected();
    return this.subscribe(topic, handler as EventHandler);
  }

  private subscribe(topic: string, handler: EventHandler): () => void {
    let set = this.handlers.get(topic);
    if (!set) {
      set = new Set();
      this.handlers.set(topic, set);
    }
    set.add(handler);
    if (!isPseudoTopic(topic)) this.bindTopic(topic);
    return () => {
      const existing = this.handlers.get(topic);
      if (!existing) return;
      existing.delete(handler);
      if (existing.size === 0) this.handlers.delete(topic);
    };
  }

  private ensureConnected(): void {
    if (typeof window === 'undefined') return;
    if (this.es) return;

    const url = `${getQuantAgentApiBase()}/events`;
    const es = new EventSource(url);
    this.es = es;

    es.addEventListener('open', () => {
      this.connectCount += 1;
      this.emit(CONNECTION.CONNECTED, this.connectCount);
    });

    es.addEventListener('error', () => {
      this.emit(CONNECTION.ERROR, null);
    });

    for (const topic of this.topicsBound) {
      es.addEventListener(topic, this.makeTopicListener(topic));
    }
  }

  private emit(topic: string, data: unknown): void {
    const handlers = this.handlers.get(topic);
    if (!handlers || handlers.size === 0) return;
    for (const handler of handlers) {
      try {
        handler(data);
      } catch (err) {
        console.error('[event-bus] handler error', topic, err);
      }
    }
  }

  private bindTopic(topic: string): void {
    if (isPseudoTopic(topic)) return;
    if (this.topicsBound.has(topic)) return;
    this.topicsBound.add(topic);
    if (this.es) {
      this.es.addEventListener(topic, this.makeTopicListener(topic));
    }
  }

  private makeTopicListener(topic: string): (event: MessageEvent) => void {
    return (event: MessageEvent) => {
      try {
        const wire = JSON.parse(event.data) as WireEnvelope;
        this.emit(topic, wire.data);
      } catch (err) {
        console.warn('[event-bus] invalid payload for topic', topic, err);
      }
    };
  }
}

export const eventBus = new EventBusClient();
