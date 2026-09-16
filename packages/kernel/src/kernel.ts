/**
 * Core Kernel - النواة الكودية النووية الذرية
 * 
 * أصغر مجموعة من العقود والـprimitives التي لا يستطيع النظام تجاوزها
 * Typed + Deterministic + Immutable Events + Explicit State Machine + Policy Enforcement + Persistence + Recovery + Auditability
 * 
 * Who? What state? What requested? Is it allowed? What happened? What was executed? Was it saved?
 * 
 * IDENTITY + STATE + COMMAND + POLICY + EVENT + EXECUTION + PERSISTENCE
 */

import type { Command } from './commands/command.js';
import { validateCommand } from './commands/command.js';
import type { Event } from './events/event.js';
import type { State } from './state/machine.js';
import type { ExecutionContext } from './context/execution-context.js';
import type { Result } from './execution/result.js';
import type { Repository } from './persistence/repository.js';
import { InMemoryRepository } from './persistence/repository.js';
import type { EventStore } from './events/event-store.js';
import { InMemoryEventStore } from './events/event-store.js';
import { Authorizer, decide } from './policy/authorization.js';
import type { Policy } from './policy/policy.js';
import { InMemoryExecutor } from './execution/executor.js';
import type { Executor } from './execution/executor.js';
import { replayEvents, recoverState } from './state/reducer.js';
import { checkAllInvariants, assertInvariants } from './invariants/invariants.js';
import { CoreError, PolicyDeniedError, InvalidTransitionError } from './errors/core-error.js';
import { createCommandId, createEventId } from './identity/identity.js';

export interface CoreKernel {
  // Atomic Operations - عمليات صغيرة جداً
  dispatch(command: Command, context: ExecutionContext): Promise<Result>;
  authorize(command: Command, context: ExecutionContext): Promise<{ allowed: boolean; needsApproval: boolean; reason: string }>;
  transition(event: Event): Promise<State>;
  appendEvent(event: Event): Promise<void>;
  getState(id: string): Promise<State | null>;
  getEvents(aggregateId: string): Promise<Event[]>;
  persist(state: State, events: Event[]): Promise<void>;
  recover(id: string): Promise<State>;
  replay(aggregateId: string): Promise<State | null>;
  
  // Composed operations
  createTask(payload: Record<string, unknown>, context: ExecutionContext): Promise<Result>;
  getAllStates(): Promise<State[]>;
  getAllEvents(): Promise<Event[]>;
}

export interface KernelConfig {
  repository?: Repository;
  eventStore?: EventStore;
  executor?: Executor;
  policies?: Policy[];
}

export class AtomicKernel implements CoreKernel {
  private repository: Repository;
  private eventStore: EventStore;
  private executor: Executor;
  private authorizer: Authorizer;

  constructor(config: KernelConfig = {}) {
    this.repository = config.repository || new InMemoryRepository();
    this.eventStore = config.eventStore || new InMemoryEventStore();
    this.executor = config.executor || new InMemoryExecutor();
    this.authorizer = new Authorizer(config.policies);
  }

  // authorize - هل العملية مسموحة؟
  async authorize(command: Command, context: ExecutionContext) {
    const state = command.aggregateId ? await this.repository.states.getById(command.aggregateId) : null;
    const stateForAuth = state ?? undefined;
    const result = await this.authorizer.authorize(command, context, stateForAuth);
    
    // Check invariants - respect exactOptionalPropertyTypes
    const invariantParams: Parameters<typeof checkAllInvariants>[0] = {
      command,
      context,
      ...(stateForAuth !== undefined ? { state: stateForAuth } : {})
    };
    const invariantCheck = checkAllInvariants(invariantParams);
    if (!invariantCheck.valid) {
      return {
        allowed: false,
        needsApproval: false,
        reason: `Invariant violation: ${invariantCheck.violations.map(v => v.invariant).join(', ')}`
      };
    }

    return {
      allowed: result.allowed,
      needsApproval: result.needsApproval,
      reason: result.reason
    };
  }

  // dispatch - Command -> Policy -> Execution -> Event -> State -> Persistence
  // أنظف نموذج: Command -> Policy -> Execution -> Event -> State
  async dispatch(command: Command, context: ExecutionContext): Promise<Result> {
    // 1. Validate - المدخلات لا تدخل التنفيذ مباشرة
    const validation = validateCommand(command);
    if (!validation.valid) {
      throw new CoreError('VALIDATION_FAILED', `Invalid command: ${validation.errors.join(', ')}`, { commandId: command.id });
    }

    // 2. Check invariants before
    assertInvariants({ command, context });

    // 3. Get current state
    const currentState = command.aggregateId ? await this.repository.states.getById(command.aggregateId) : null;

    // 4. Authorize - Decision = f(currentState, command, policy, context) - Deterministic Core
    const auth = await this.authorize(command, context);
    
    if (!auth.allowed) {
      if (auth.needsApproval) {
        throw new CoreError('POLICY_NEEDS_APPROVAL', auth.reason, { commandId: command.id });
      }
      // Invariant: deniedActionCannotReachExecutor
      throw new PolicyDeniedError(auth.reason, { commandId: command.id });
    }

    // 5. Check if executor can handle
    if (!this.executor.canExecute(command)) {
      throw new CoreError('EXECUTION_FAILED', `Executor ${this.executor.name} cannot execute ${command.type}`);
    }

    // 6. Execute
    const result = await this.executor.execute(command, context, currentState || undefined);

    // 7. Check invariants after execution
    for (const event of result.events) {
      assertInvariants({ event, command, context, state: currentState });
    }

    // 8. Persist - State + Events atomically
    if (result.status === 'SUCCESS' && result.data?.newState) {
      const newState = result.data.newState as State;
      await this.persist(newState, result.events);
    } else if (result.events.length > 0) {
      // Even if no new state, persist events
      for (const event of result.events) {
        await this.eventStore.append(event);
        await this.repository.events.append(event);
      }
    }

    return result;
  }

  async transition(event: Event): Promise<State> {
    const currentState = await this.repository.states.getById(event.aggregateId);
    const { stateReducer } = await import('./state/reducer.js');
    const newState = stateReducer(currentState, event);
    
    // Invariant check
    assertInvariants({ state: newState, event });
    
    return newState;
  }

  async appendEvent(event: Event): Promise<void> {
    assertInvariants({ event });
    await this.eventStore.append(event);
    await this.repository.events.append(event);
  }

  async getState(id: string): Promise<State | null> {
    return this.repository.states.getById(id);
  }

  async getEvents(aggregateId: string): Promise<Event[]> {
    return this.eventStore.getByAggregateId(aggregateId);
  }

  async persist(state: State, events: Event[]): Promise<void> {
    // Invariant: everyStateTransitionProducesAnEvent
    if (events.length === 0) {
      throw new CoreError('INVARIANT_VIOLATION', 'everyStateTransitionProducesAnEvent: State transition must produce an event', { stateId: state.id });
    }

    assertInvariants({ state, events });

    await this.repository.saveStateAndEvents(state, events);
    for (const event of events) {
      await this.eventStore.append(event);
    }
  }

  async recover(id: string): Promise<State> {
    const events = await this.eventStore.getByAggregateId(id);
    if (events.length === 0) {
      throw new CoreError('NOT_FOUND', `No events found for ${id}`);
    }
    return recoverState(events);
  }

  async replay(aggregateId: string): Promise<State | null> {
    const events = await this.eventStore.getByAggregateId(aggregateId);
    if (events.length === 0) return null;
    return replayEvents(events);
  }

  async createTask(payload: Record<string, unknown>, context: ExecutionContext): Promise<Result> {
    const commandId = createCommandId();
    const command = {
      id: commandId,
      type: 'CREATE_TASK' as const,
      payload,
      timestamp: context.clock.now(),
      correlationId: context.correlationId,
      metadata: { source: 'kernel' }
    };

    return this.dispatch(command, context);
  }

  async getAllStates(): Promise<State[]> {
    return this.repository.states.getAll();
  }

  async getAllEvents(): Promise<Event[]> {
    return this.eventStore.getAll();
  }

  // For testing - clear
  clear(): void {
    if ('clear' in this.repository && typeof (this.repository as any).clear === 'function') {
      (this.repository as any).clear();
    }
    if ('clear' in this.eventStore && typeof (this.eventStore as any).clear === 'function') {
      (this.eventStore as any).clear();
    }
  }
}

// Singleton for convenience - لكن يمكن إنشاء multiple kernels
export const kernel = new AtomicKernel();

// Factory
export function createKernel(config?: KernelConfig): CoreKernel {
  return new AtomicKernel(config);
}
