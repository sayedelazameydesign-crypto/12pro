/**
 * Reducer - النواة الذرية: State derived from Events
 * الحالة تُشتق من الأحداث - Immutable Events
 */

import type { Event } from '../events/event.js';
import type { State, StateType } from './machine.js';
import { createInitialState, transitionState } from './machine.js';

export type Reducer = (state: State | null, event: Event) => State;

export function stateReducer(state: State | null, event: Event): State {
  // If no state, must be creation event
  if (!state) {
    if (event.type === 'MISSION_CREATED' || event.type === 'TASK_CREATED') {
      return createInitialState(event.aggregateId, event.payload as Record<string, unknown>);
    }
    throw new Error(`[Reducer] No state for event ${event.type} on aggregate ${event.aggregateId}`);
  }

  // Map events to state transitions
  const eventToTransition: Record<string, StateType> = {
    'MISSION_PLANNING_STARTED': 'PLANNING',
    'TASK_PLANNING_STARTED': 'PLANNING',
    'PLANNING_COMPLETED': 'READY',
    'EXECUTION_STARTED': 'RUNNING',
    'TASK_STARTED': 'RUNNING',
    'EXECUTION_WAITING': 'WAITING',
    'TASK_WAITING': 'WAITING',
    'TASK_COMPLETED': 'COMPLETED',
    'MISSION_COMPLETED': 'COMPLETED',
    'TASK_FAILED': 'FAILED',
    'MISSION_FAILED': 'FAILED',
    'TASK_CANCELLED': 'CANCELLED',
    'MISSION_CANCELLED': 'CANCELLED',
    'TASK_BLOCKED': 'BLOCKED',
    'TASK_UNBLOCKED': 'READY',
    'TASK_RETRY': 'READY',
    'MISSION_RETRY': 'READY'
  };

  const targetState = eventToTransition[event.type];
  if (!targetState) {
    // Unknown event - keep state but update data
    return {
      ...state,
      version: state.version + 1,
      updatedAt: event.timestamp,
      data: { ...state.data, ...(event.payload as Record<string, unknown>) }
    };
  }

  return transitionState(state, targetState, event.payload as Record<string, unknown>);
}

// Replay - استعادة الحالة من الأحداث (auditability + recovery + replay)
export function replayEvents(events: Event[], initialState: State | null = null): State | null {
  return events
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .reduce((state, event) => stateReducer(state, event), initialState);
}

// Recover - استعادة النظام
export function recoverState(events: Event[]): State {
  const state = replayEvents(events);
  if (!state) {
    throw new Error('[Recover] No state could be recovered from events');
  }
  return state;
}
