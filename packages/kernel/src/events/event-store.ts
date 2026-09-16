/**
 * Event Store - النواة الذرية: Persistence of Immutable Events
 * تخزين الأحداث - append-only, لا تعديل
 */

import type { Event } from './event.js';

export interface EventStore {
  append(event: Event): Promise<void>;
  appendMany(events: Event[]): Promise<void>;
  getByAggregateId(aggregateId: string): Promise<Event[]>;
  getByCorrelationId(correlationId: string): Promise<Event[]>;
  getAll(): Promise<Event[]>;
  getByType(type: string): Promise<Event[]>;
}

export class InMemoryEventStore implements EventStore {
  private events: Event[] = [];

  async append(event: Event): Promise<void> {
    // Invariant: version must be sequential
    const existing = this.events.filter(e => e.aggregateId === event.aggregateId);
    if (existing.length > 0) {
      const lastVersion = Math.max(...existing.map(e => e.version));
      if (event.version !== lastVersion + 1) {
        throw new Error(`[EventStore] Version mismatch for ${event.aggregateId}: expected ${lastVersion + 1}, got ${event.version}`);
      }
    } else if (event.version !== 1) {
      throw new Error(`[EventStore] First event for ${event.aggregateId} must have version 1, got ${event.version}`);
    }

    this.events.push(event);
  }

  async appendMany(events: Event[]): Promise<void> {
    for (const event of events) {
      await this.append(event);
    }
  }

  async getByAggregateId(aggregateId: string): Promise<Event[]> {
    return this.events
      .filter(e => e.aggregateId === aggregateId)
      .sort((a, b) => a.version - b.version);
  }

  async getByCorrelationId(correlationId: string): Promise<Event[]> {
    return this.events.filter(e => e.correlationId === correlationId);
  }

  async getAll(): Promise<Event[]> {
    return [...this.events].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  async getByType(type: string): Promise<Event[]> {
    return this.events.filter(e => e.type === type);
  }

  // For testing - clear
  clear(): void {
    this.events = [];
  }

  count(): number {
    return this.events.length;
  }
}
