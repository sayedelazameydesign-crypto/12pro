/**
 * Persistence - النواة الذرية: تخزين الحالة والأحداث
 * Repository pattern - لا SQLite-specific queries في النواة، بل interfaces
 */

import type { State } from '../state/machine.js';
import type { Event } from '../events/event.js';

export interface StateRepository {
  save(state: State): Promise<void>;
  getById(id: string): Promise<State | null>;
  getAll(): Promise<State[]>;
  delete(id: string): Promise<void>;
}

export interface Repository {
  states: StateRepository;
  events: {
    append(event: Event): Promise<void>;
    getByAggregateId(aggregateId: string): Promise<Event[]>;
    getAll(): Promise<Event[]>;
  };
  // Transactional save - state + events atomically
  saveStateAndEvents(state: State, events: Event[]): Promise<void>;
}

export class InMemoryStateRepository implements StateRepository {
  private states = new Map<string, State>();

  async save(state: State): Promise<void> {
    // Optimistic concurrency check
    const existing = this.states.get(state.id);
    if (existing && existing.version >= state.version) {
      throw new Error(`[Persistence] Version conflict for ${state.id}: existing ${existing.version} >= new ${state.version}`);
    }
    this.states.set(state.id, state);
  }

  async getById(id: string): Promise<State | null> {
    return this.states.get(id) || null;
  }

  async getAll(): Promise<State[]> {
    return Array.from(this.states.values());
  }

  async delete(id: string): Promise<void> {
    this.states.delete(id);
  }

  clear(): void {
    this.states.clear();
  }
}

export class InMemoryRepository implements Repository {
  public states: StateRepository;
  private eventStore: Event[] = [];

  constructor() {
    this.states = new InMemoryStateRepository();
  }

  get events() {
    return {
      append: async (event: Event) => {
        this.eventStore.push(event);
      },
      getByAggregateId: async (aggregateId: string) => {
        return this.eventStore.filter(e => e.aggregateId === aggregateId).sort((a,b) => a.version - b.version);
      },
      getAll: async () => {
        return [...this.eventStore].sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      }
    };
  }

  async saveStateAndEvents(state: State, events: Event[]): Promise<void> {
    // Atomic operation - النواة الذرية
    await this.states.save(state);
    for (const event of events) {
      await this.events.append(event);
    }
  }

  clear(): void {
    (this.states as InMemoryStateRepository).clear();
    this.eventStore = [];
  }
}

// Adapter for real persistence - خارج النواة
export interface PersistenceAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getRepository(): Repository;
}

// Example: SQLite adapter would implement PersistenceAdapter
// لكن لا SQLite-specific queries في النواة نفسها
export class MockPersistenceAdapter implements PersistenceAdapter {
  private repo = new InMemoryRepository();
  
  async connect(): Promise<void> {
    console.log('[MockPersistence] Connected');
  }
  
  async disconnect(): Promise<void> {
    console.log('[MockPersistence] Disconnected');
  }
  
  getRepository(): Repository {
    return this.repo;
  }
}
