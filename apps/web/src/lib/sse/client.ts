/**
 * SSE Client for CeliaOS - Real-time events streaming
 * Contract: GET /api/v1/events/stream
 */

export interface SSEEvent {
  id: string;
  type: string;
  missionId?: string;
  conversationId?: string;
  stepId?: string;
  timestamp: string;
  data: any;
}

export type SSEEventHandler = (event: SSEEvent) => void;

export class SSEClient {
  private eventSource: EventSource | null = null;
  private handlers: Map<string, Set<SSEEventHandler>> = new Map();
  private globalHandlers: Set<SSEEventHandler> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private url: string;

  constructor(url = '/api/v1/events/stream') {
    this.url = url;
  }

  connect(): void {
    if (this.eventSource) {
      this.disconnect();
    }

    console.log(`[sse] Connecting to ${this.url}`);
    this.eventSource = new EventSource(this.url);

    this.eventSource.onopen = () => {
      console.log('[sse] Connected');
      this.reconnectAttempts = 0;
    };

    this.eventSource.onmessage = (e) => {
      try {
        const event: SSEEvent = JSON.parse(e.data);
        this.dispatch(event);
      } catch (err) {
        console.warn('[sse] Failed to parse event', e.data, err);
      }
    };

    this.eventSource.onerror = (err) => {
      console.error('[sse] Error', err);
      this.eventSource?.close();
      
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
        console.log(`[sse] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
        setTimeout(() => this.connect(), delay);
      } else {
        console.error('[sse] Max reconnect attempts reached');
      }
    };

    // Listen for typed events
    const eventTypes = [
      'mission.created',
      'mission.started',
      'mission.step.started',
      'mission.step.completed',
      'mission.step.failed',
      'mission.completed',
      'mission.failed',
      'tool.call.started',
      'tool.call.completed',
      'approval.requested',
      'approval.decided',
      'memory.written',
      'message.created',
      'conversation.created'
    ];

    for (const type of eventTypes) {
      this.eventSource.addEventListener(type, (e: MessageEvent) => {
        try {
          const event: SSEEvent = JSON.parse(e.data);
          this.dispatch(event);
        } catch (err) {
          console.warn(`[sse] Failed to parse typed event ${type}`, err);
        }
      });
    }
  }

  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      console.log('[sse] Disconnected');
    }
  }

  on(type: string, handler: SSEEventHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
    return () => this.off(type, handler);
  }

  onAny(handler: SSEEventHandler): () => void {
    this.globalHandlers.add(handler);
    return () => this.globalHandlers.delete(handler);
  }

  off(type: string, handler: SSEEventHandler): void {
    this.handlers.get(type)?.delete(handler);
  }

  private dispatch(event: SSEEvent): void {
    // Global handlers
    for (const handler of this.globalHandlers) {
      try {
        handler(event);
      } catch (e) {
        console.error('[sse] Global handler error', e);
      }
    }

    // Typed handlers
    const typedHandlers = this.handlers.get(event.type);
    if (typedHandlers) {
      for (const handler of typedHandlers) {
        try {
          handler(event);
        } catch (e) {
          console.error(`[sse] Handler error for ${event.type}`, e);
        }
      }
    }

    // Wildcard mission handlers
    if (event.missionId) {
      const missionHandlers = this.handlers.get(`mission:${event.missionId}`);
      if (missionHandlers) {
        for (const handler of missionHandlers) {
          try {
            handler(event);
          } catch (e) {
            console.error(`[sse] Mission handler error`, e);
          }
        }
      }
    }
  }

  // For testing: mock event
  mockEvent(event: SSEEvent): void {
    this.dispatch(event);
  }
}

// Singleton
let sseClient: SSEClient | null = null;

export function getSSEClient(): SSEClient {
  if (!sseClient) {
    sseClient = new SSEClient();
  }
  return sseClient;
}

export default SSEClient;
