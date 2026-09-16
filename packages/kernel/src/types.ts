/**
 * Types - النواة الذرية: كل مدخل ومخرج له contract
 * Typed + Validated + Observable
 */

export * from './identity/identity.js';
export * from './context/execution-context.js';
export * from './state/machine.js';
export * from './events/event.js';
export * from './commands/command.js';
export * from './policy/policy.js';
export * from './execution/result.js';
export * from './errors/core-error.js';

// Re-export invariants
export * from './invariants/invariants.js';

// Core types summary
export type {
  State,
  StateType
} from './state/machine.js';

export type {
  Event,
  EventType
} from './events/event.js';

export type {
  Command,
  CommandType
} from './commands/command.js';

export type {
  PolicyDecision,
  PolicyDecisionType
} from './policy/policy.js';

export type {
  Result,
  ResultStatus
} from './execution/result.js';

export type {
  Identity,
  MissionId,
  TaskId,
  ExecutionId,
  EventId,
  CommandId
} from './identity/identity.js';

export type {
  ExecutionContext,
  Clock
} from './context/execution-context.js';
