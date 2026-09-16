/**
 * Executor - النواة الذرية: Execution Contract
 * تنفيذ العملية وفق عقد واضح - لا LLM مباشرة في النواة
 */

import type { Command } from '../commands/command.js';
import type { ExecutionContext } from '../context/execution-context.js';
import type { State } from '../state/machine.js';
import type { Event } from '../events/event.js';
import type { Result } from './result.js';
import { createSuccessResult, createFailureResult } from './result.js';
import { createEvent } from '../events/event.js';
import { createEventId } from '../identity/identity.js';
import { transitionState } from '../state/machine.js';
import type { StateType } from '../state/machine.js';

export interface Executor {
  readonly name: string;
  canExecute(command: Command): boolean;
  execute(command: Command, context: ExecutionContext, state?: State | null): Promise<Result>;
}

// In-memory executor for testing - يمثل طبقة التنفيذ بدون LLM
export class InMemoryExecutor implements Executor {
  readonly name = 'InMemoryExecutor';

  canExecute(command: Command): boolean {
    return true; // Can execute all for testing
  }

  async execute(command: Command, context: ExecutionContext, state?: State | null): Promise<Result> {
    const start = context.clock.nowMs();
    
    try {
      // Simulate execution based on command type
      const { eventType, nextState } = this.mapCommandToEvent(command);
      
      let newState = state;
      const events: Event[] = [];

      if (state && nextState) {
        // Transition state
        newState = transitionState(state, nextState as StateType, command.payload as Record<string, unknown>);
        
        // Create event - Invariant: everyStateTransitionProducesAnEvent
        const event = createEvent({
          id: createEventId(),
          type: eventType as any,
          aggregateId: state.id,
          aggregateType: state.id.startsWith('mission') ? 'mission' : 'task',
          version: newState.version,
          timestamp: context.clock.now(),
          correlationId: context.correlationId,
          causationId: command.id,
          payload: command.payload,
          metadata: { agentId: context.agentId, source: this.name }
        });
        
        events.push(event);
      } else if (!state && (command.type === 'CREATE_MISSION' || command.type === 'CREATE_TASK')) {
        const aggregateId = (command.payload.missionId as string) || (command.payload.taskId as string) || `mission_${Date.now()}`;
        const { createInitialState } = await import('../state/machine.js');
        newState = createInitialState(aggregateId, command.payload as Record<string, unknown>);
        
        const event = createEvent({
          id: createEventId(),
          type: command.type === 'CREATE_MISSION' ? 'MISSION_CREATED' as any : 'TASK_CREATED' as any,
          aggregateId,
          aggregateType: command.type === 'CREATE_MISSION' ? 'mission' : 'task',
          version: 1,
          timestamp: context.clock.now(),
          correlationId: context.correlationId,
          causationId: command.id,
          payload: command.payload,
          metadata: { source: this.name }
        });
        events.push(event);
      }

      const duration = context.clock.nowMs() - start;

      return createSuccessResult({
        id: `result_${command.id}`,
        commandId: command.id,
        aggregateId: state?.id || (command.payload.missionId as string) || command.id,
        timestamp: context.clock.now(),
        correlationId: context.correlationId,
        data: { newState, executed: true },
        events,
        durationMs: duration
      });

    } catch (error) {
      const duration = context.clock.nowMs() - start;
      
      return createFailureResult({
        id: `result_${command.id}`,
        commandId: command.id,
        aggregateId: state?.id || command.id,
        timestamp: context.clock.now(),
        correlationId: context.correlationId,
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : String(error)
        },
        events: [],
        durationMs: duration
      });
    }
  }

  private mapCommandToEvent(command: Command): { eventType: string; nextState?: string } {
    const map: Record<string, { eventType: string; nextState?: string }> = {
      'CREATE_MISSION': { eventType: 'MISSION_CREATED' },
      'START_MISSION': { eventType: 'EXECUTION_STARTED', nextState: 'RUNNING' },
      'CREATE_TASK': { eventType: 'TASK_CREATED' },
      'START_TASK': { eventType: 'TASK_STARTED', nextState: 'RUNNING' },
      'COMPLETE_TASK': { eventType: 'TASK_COMPLETED', nextState: 'COMPLETED' },
      'FAIL_TASK': { eventType: 'TASK_FAILED', nextState: 'FAILED' },
      'CANCEL_TASK': { eventType: 'TASK_CANCELLED', nextState: 'CANCELLED' },
      'BLOCK_TASK': { eventType: 'TASK_BLOCKED', nextState: 'BLOCKED' },
      'UNBLOCK_TASK': { eventType: 'TASK_UNBLOCKED', nextState: 'READY' },
      'RETRY_TASK': { eventType: 'TASK_RETRY', nextState: 'READY' },
      'EXECUTE_TOOL': { eventType: 'EXECUTION_COMPLETED', nextState: 'COMPLETED' }
    };

    return map[command.type] || { eventType: 'EXECUTION_COMPLETED', nextState: 'COMPLETED' };
  }
}

// Adapter interface - النواة لا تحتوي مباشرة على LLM SDKs, Browser, etc.
// بل interfaces/contracts، و Adapters تنفذها
export interface ToolAdapter {
  readonly toolName: string;
  execute(payload: Record<string, unknown>, context: ExecutionContext): Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }>;
}

// Example adapters - خارج النواة، في طبقة adapters
export class MockLLMAdapter implements ToolAdapter {
  readonly toolName = 'llm_call';
  async execute(payload: Record<string, unknown>, context: ExecutionContext) {
    // Mock - لا LLM حقيقي في النواة
    return { success: true, data: { response: `Mock LLM response for ${payload.prompt}` } };
  }
}

export class MockBrowserAdapter implements ToolAdapter {
  readonly toolName = 'browser_navigate';
  async execute(payload: Record<string, unknown>, context: ExecutionContext) {
    return { success: true, data: { url: payload.url, title: 'Mock Page' } };
  }
}
