/**
 * Command - النواة الذرية: What requested?
 * طلب تنفيذ عملية - يمر عبر Policy قبل Execution
 */

import type { CommandId } from '../identity/identity.js';

export type CommandType =
  | 'CREATE_MISSION'
  | 'CREATE_TASK'
  | 'START_MISSION'
  | 'START_TASK'
  | 'COMPLETE_TASK'
  | 'FAIL_TASK'
  | 'CANCEL_MISSION'
  | 'CANCEL_TASK'
  | 'BLOCK_TASK'
  | 'UNBLOCK_TASK'
  | 'RETRY_TASK'
  | 'EXECUTE_TOOL'
  | 'APPROVE_MISSION'
  | 'DENY_MISSION';

export interface Command {
  readonly id: CommandId;
  readonly type: CommandType;
  readonly aggregateId?: string; // missionId or taskId if existing
  readonly payload: Record<string, unknown>;
  readonly timestamp: string;
  readonly correlationId: string;
  readonly causationId?: string;
  readonly metadata: {
    readonly agentId?: string;
    readonly sessionId?: string;
    readonly userId?: string;
    readonly source: string;
  };
}

export function createCommand(params: {
  id: CommandId;
  type: CommandType;
  aggregateId?: string;
  payload?: Record<string, unknown>;
  timestamp: string;
  correlationId: string;
  causationId?: string;
  metadata?: Partial<Command['metadata']>;
}): Command {
  return {
    id: params.id,
    type: params.type,
    aggregateId: params.aggregateId,
    payload: params.payload || {},
    timestamp: params.timestamp,
    correlationId: params.correlationId,
    causationId: params.causationId,
    metadata: {
      source: 'api',
      ...params.metadata
    }
  };
}

// Validation - المدخلات لا تدخل التنفيذ مباشرة
export function validateCommand(command: Command): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!command.id) errors.push('Command must have id');
  if (!command.type) errors.push('Command must have type');
  if (!command.correlationId) errors.push('Command must have correlationId');
  if (!command.timestamp) errors.push('Command must have timestamp');

  // Specific validations
  if (command.type === 'CREATE_MISSION' && !command.payload.goal) {
    errors.push('CREATE_MISSION must have goal');
  }

  if (command.type === 'EXECUTE_TOOL' && !command.payload.tool) {
    errors.push('EXECUTE_TOOL must have tool');
  }

  return { valid: errors.length === 0, errors };
}
