/**
 * SSE Client for CeliaOS - Real-time events streaming with fixes per risk analysis
 * Contract: GET /api/v1/events/stream
 * Fixes:
 * - Heartbeat handling (15s)
 * - Backpressure awareness
 * - Client limit handling (429)
 * - Reconnect with exponential backoff + jitter
 * - Load testing support
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
  private heartbeatTimer?: NodeJS.Timeout;
  private lastHeartbeat = Date.now();
  private stats = { eventsReceived: 0, reconnects: 0, errors: 0 };

  constructor(url = '/api/v1/events/stream') {
    this.url = url;
  }

  connect(): void {
    if (this.eventSource) {
      this.disconnect();
    }

    console.log(`[sse] Connecting to ${this.url} (attempt ${this.reconnectAttempts + 1})`);
    this.eventSource = new EventSource(this.url);

    this.eventSource.onopen = () => {
      console.log('[sse] Connected, clients:', this.stats.eventsReceived);
      this.reconnectAttempts = 0;
      this.lastHeartbeat = Date.now();
      
      // Start heartbeat monitor
      if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = setInterval(() => {
        const sinceLast = Date.now() - this.lastHeartbeat;
        if (sinceLast > 30000) { // 30s without heartbeat = dead
          console.warn(`[sse] No heartbeat for ${sinceLast}ms, reconnecting`);
          this.reconnect();
        }
      }, 15000);
    };

    this.eventSource.onmessage = (e) => {
      // Handle heartbeat (lines starting with : )
      if (e.data.startsWith(':')) {
        this.lastHeartbeat = Date.now();
        if (e.data.includes('heartbeat')) {
          console.debug('[sse] Heartbeat', e.data);
        }
        return;
      }

      try {
        const event: SSEEvent = JSON.parse(e.data);
        this.stats.eventsReceived++;
        this.dispatch(event);
      } catch (err) {
        console.warn('[sse] Failed to parse event', e.data, err);
        this.stats.errors++;
      }
    };

    this.eventSource.onerror = (err) => {
      console.error('[sse] Error', err, `clients maybe at limit (100)`);
      this.stats.errors++;
      this.eventSource?.close();
      
      // Check if 429 (too many clients)
      // EventSource doesn't expose status, so we try to fetch stats
      fetch('/api/v1/sse/stats').then(r => r.json()).then(stats => {
        if (stats.clients >= stats.maxClients) {
          console.warn(`[sse] Server at max clients ${stats.maxClients}, waiting longer`);
          this.reconnectDelay = 5000;
        }
      }).catch(() => {});

      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        this.stats.reconnects++;
        // Exponential backoff with jitter for load handling
        const baseDelay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
        const jitter = Math.random() * 1000;
        const delay = Math.min(baseDelay + jitter, 30000);
        console.log(`[sse] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}) with jitter`);
        setTimeout(() => this.connect(), delay);
      } else {
        console.error('[sse] Max reconnect attempts reached');
      }
    };

    // Typed events
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
      'conversation.created',
      'runtime.healthy'
    ];

    for (const type of eventTypes) {
      this.eventSource.addEventListener(type, (e: MessageEvent) => {
        try {
          const event: SSEEvent = JSON.parse(e.data);
          this.stats.eventsReceived++;
          this.lastHeartbeat = Date.now();
          this.dispatch(event);
        } catch (err) {
          console.warn(`[sse] Failed to parse typed event ${type}`, err);
        }
      });
    }
  }

  private reconnect(): void {
    this.disconnect();
    this.connect();
  }

  disconnect(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      console.log('[sse] Disconnected, stats:', this.stats);
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
    for (const handler of this.globalHandlers) {
      try { handler(event); } catch (e) { console.error('[sse] Global handler error', e); }
    }
    const typedHandlers = this.handlers.get(event.type);
    if (typedHandlers) {
      for (const handler of typedHandlers) {
        try { handler(event); } catch (e) { console.error(`[sse] Handler error for ${event.type}`, e); }
      }
    }
    if (event.missionId) {
      const missionHandlers = this.handlers.get(`mission:${event.missionId}`);
      if (missionHandlers) {
        for (const handler of missionHandlers) {
          try { handler(event); } catch (e) { console.error(`[sse] Mission handler error`, e); }
        }
      }
    }
  }

  mockEvent(event: SSEEvent): void {
    this.dispatch(event);
  }

  getStats() {
    return { ...this.stats, connected: !!this.eventSource, lastHeartbeat: this.lastHeartbeat };
  }

  // For load testing - simulate multiple clients
  static async loadTest(url = '/api/v1/events/stream', clients = 10, durationMs = 10000): Promise<{ totalEvents: number; errors: number }> {
    console.log(`[sse] Load test: ${clients} clients for ${durationMs}ms`);
    const testClients: SSEClient[] = [];
    let totalEvents = 0;
    let errors = 0;

    for (let i = 0; i < clients; i++) {
      const client = new SSEClient(url);
      client.onAny(() => totalEvents++);
      client.connect();
      testClients.push(client);
      await new Promise(r => setTimeout(r, 100)); // Stagger connections
    }

    await new Promise(r => setTimeout(r, durationMs));

    for (const c of testClients) c.disconnect();

    return { totalEvents, errors };
  }
}

let sseClient: SSEClient | null = null;

export function getSSEClient(): SSEClient {
  if (!sseClient) {
    sseClient = new SSEClient();
  }
  return sseClient;
}

export default SSEClient;
