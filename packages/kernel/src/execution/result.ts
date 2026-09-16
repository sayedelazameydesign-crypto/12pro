/**
 * Result - النواة الذرية: النتيجة الموثقة للتنفيذ
 */

import type { Event } from '../events/event.js';

export type ResultStatus = 'SUCCESS' | 'FAILURE' | 'PENDING';

export interface Result {
  readonly id: string;
  readonly status: ResultStatus;
  readonly commandId: string;
  readonly aggregateId: string;
  readonly timestamp: string;
  readonly correlationId: string;
  readonly data?: Record<string, unknown>;
  readonly error?: {
    readonly code: string;
    readonly message: string;
    readonly details?: Record<string, unknown>;
  };
  readonly events: Event[]; // Events produced by this execution
  readonly metadata: {
    readonly durationMs: number;
    readonly attempts: number;
  };
}

export function createSuccessResult(params: {
  id: string;
  commandId: string;
  aggregateId: string;
  timestamp: string;
  correlationId: string;
  data?: Record<string, unknown>;
  events: Event[];
  durationMs: number;
}): Result {
  return {
    id: params.id,
    status: 'SUCCESS',
    commandId: params.commandId,
    aggregateId: params.aggregateId,
    timestamp: params.timestamp,
    correlationId: params.correlationId,
    data: params.data,
    events: params.events,
    metadata: { durationMs: params.durationMs, attempts: 1 }
  };
}

export function createFailureResult(params: {
  id: string;
  commandId: string;
  aggregateId: string;
  timestamp: string;
  correlationId: string;
  error: { code: string; message: string; details?: Record<string, unknown> };
  events: Event[];
  durationMs: number;
}): Result {
  return {
    id: params.id,
    status: 'FAILURE',
    commandId: params.commandId,
    aggregateId: params.aggregateId,
    timestamp: params.timestamp,
    correlationId: params.correlationId,
    error: params.error,
    events: params.events,
    metadata: { durationMs: params.durationMs, attempts: 1 }
  };
}
