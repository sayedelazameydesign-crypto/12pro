/**
 * Event - النواة الذرية: Immutable Events
 * كل تغيير مهم يسجل كحدث - لا تعديل مباشر للحالة
 * هذا مهم لـ auditability + recovery + replay
 */

import type { EventId } from '../identity/identity.js';

export type EventType =
  | 'MISSION_CREATED'
  | 'MISSION_PLANNING_STARTED'
  | 'MISSION_COMPLETED'
  | 'MISSION_FAILED'
  | 'MISSION_CANCELLED'
  | 'MISSION_RETRY'
  | 'TASK_CREATED'
  | 'TASK_PLANNING_STARTED'
  | 'TASK_STARTED'
  | 'TASK_COMPLETED'
  | 'TASK_FAILED'
  | 'TASK_CANCELLED'
  | 'TASK_BLOCKED'
  | 'TASK_UNBLOCKED'
  | 'TASK_RETRY'
  | 'TASK_WAITING'
  | 'EXECUTION_STARTED'
  | 'EXECUTION_COMPLETED'
  | 'EXECUTION_FAILED'
  | 'EXECUTION_WAITING'
  | 'PLANNING_COMPLETED'
  | 'POLICY_DECISION'
  | 'BUDGET_EXCEEDED'
  | 'APPROVAL_REQUESTED'
  | 'APPROVAL_GRANTED'
  | 'APPROVAL_DENIED';

export interface Event {
  readonly id: EventId;
  readonly type: EventType;
  readonly aggregateId: string; // missionId or taskId
  readonly aggregateType: 'mission' | 'task' | 'execution';
  readonly version: number; // Version of aggregate after this event
  readonly timestamp: string; // ISO - immutable
  readonly correlationId: string;
  readonly causationId?: string; // Which command caused this event?
  readonly payload: Record<string, unknown>; // Event data
  readonly metadata: {
    readonly agentId?: string;
    readonly sessionId?: string;
    readonly userId?: string;
    readonly source: string; // Which component produced event
  };
}

export function createEvent(params: {
  id: EventId;
  type: EventType;
  aggregateId: string;
  aggregateType: 'mission' | 'task' | 'execution';
  version: number;
  timestamp: string;
  correlationId: string;
  causationId?: string;
  payload?: Record<string, unknown>;
  metadata?: Partial<Event['metadata']>;
}): Event {
  return {
    id: params.id,
    type: params.type,
    aggregateId: params.aggregateId,
    aggregateType: params.aggregateType,
    version: params.version,
    timestamp: params.timestamp,
    correlationId: params.correlationId,
    causationId: params.causationId,
    payload: params.payload || {},
    metadata: {
      source: 'kernel',
      ...params.metadata
    }
  };
}

// Invariant: everyStateTransitionProducesAnEvent
export function assertEventForTransition(event: Event | null, from: string, to: string): void {
  if (!event) {
    throw new Error(`[Invariant:everyStateTransitionProducesAnEvent] Transition ${from} -> ${to} must produce an event`);
  }
}
