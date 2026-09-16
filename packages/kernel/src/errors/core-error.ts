/**
 * Error - النواة الذرية: أخطاء موحدة قابلة للتصنيف والمعالجة
 */

export type ErrorCode =
  | 'INVALID_COMMAND'
  | 'INVALID_STATE_TRANSITION'
  | 'POLICY_DENIED'
  | 'POLICY_NEEDS_APPROVAL'
  | 'INVARIANT_VIOLATION'
  | 'IDENTITY_MISSING'
  | 'EXECUTION_FAILED'
  | 'PERSISTENCE_FAILED'
  | 'BUDGET_EXCEEDED'
  | 'TIMEOUT'
  | 'NOT_FOUND'
  | 'ALREADY_EXISTS'
  | 'VALIDATION_FAILED';

export class CoreError extends Error {
  public readonly code: ErrorCode;
  public readonly timestamp: string;
  public readonly context?: Record<string, unknown>;
  public override readonly cause?: Error;

  constructor(code: ErrorCode, message: string, context?: Record<string, unknown>, cause?: Error) {
    super(message);
    this.name = 'CoreError';
    this.code = code;
    this.timestamp = new Date().toISOString();
    this.context = context;
    this.cause = cause;
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      timestamp: this.timestamp,
      context: this.context,
      cause: this.cause?.message
    };
  }
}

export class InvariantViolationError extends CoreError {
  constructor(invariant: string, message: string, context?: Record<string, unknown>) {
    super('INVARIANT_VIOLATION', `[Invariant:${invariant}] ${message}`, context);
    this.name = 'InvariantViolationError';
  }
}

export class PolicyDeniedError extends CoreError {
  constructor(reason: string, context?: Record<string, unknown>) {
    super('POLICY_DENIED', `Policy denied: ${reason}`, context);
    this.name = 'PolicyDeniedError';
  }
}

export class InvalidTransitionError extends CoreError {
  constructor(from: string, to: string, context?: Record<string, unknown>) {
    super('INVALID_STATE_TRANSITION', `Invalid transition ${from} -> ${to}`, context);
    this.name = 'InvalidTransitionError';
  }
}

export class BudgetExceededError extends CoreError {
  constructor(spent: number, max: number, context?: Record<string, unknown>) {
    super('BUDGET_EXCEEDED', `Budget exceeded: spent ${spent} > max ${max}`, context);
    this.name = 'BudgetExceededError';
  }
}
