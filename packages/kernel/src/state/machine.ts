/**
 * State Machine - النواة الذرية: Explicit State Machine
 * الحالات القانونية والانتقالات - لا تسمح COMPLETED -> RUNNING إلا عبر انتقال قانوني
 */

export type StateType =
  | 'CREATED'
  | 'PLANNING'
  | 'READY'
  | 'RUNNING'
  | 'WAITING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'BLOCKED';

export interface State {
  readonly id: string; // missionId or taskId
  readonly type: StateType;
  readonly previousType?: StateType;
  readonly version: number; // For optimistic concurrency
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly data: Record<string, unknown>; // Payload - mission goal, task details, etc.
  readonly metadata: {
    readonly attempts: number;
    readonly lastError?: string;
    readonly blockedReason?: string;
    readonly completedAt?: string;
  };
}

// Explicit transitions - ONLY these are allowed
export const ALLOWED_TRANSITIONS: Record<StateType, StateType[]> = {
  CREATED: ['PLANNING', 'READY', 'CANCELLED', 'FAILED'],
  PLANNING: ['READY', 'FAILED', 'CANCELLED', 'BLOCKED'],
  READY: ['RUNNING', 'CANCELLED', 'BLOCKED', 'FAILED'],
  RUNNING: ['WAITING', 'COMPLETED', 'FAILED', 'CANCELLED', 'BLOCKED', 'READY'], // READY for retry
  WAITING: ['RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'BLOCKED'],
  COMPLETED: [], // Terminal - no outgoing except via explicit REOPEN command which creates new version
  FAILED: ['READY', 'CANCELLED'], // Can retry -> READY
  CANCELLED: [], // Terminal
  BLOCKED: ['READY', 'CANCELLED', 'FAILED'] // Unblocked -> READY
};

export function isValidTransition(from: StateType, to: StateType): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertValidTransition(from: StateType, to: StateType): void {
  if (!isValidTransition(from, to)) {
    throw new Error(`[StateMachine] Invalid transition ${from} -> ${to}. Allowed: ${ALLOWED_TRANSITIONS[from]?.join(', ') || 'none'}`);
  }
}

export function isTerminalState(state: StateType): boolean {
  return ['COMPLETED', 'CANCELLED'].includes(state);
}

export function isFailedState(state: StateType): boolean {
  return ['FAILED', 'BLOCKED'].includes(state);
}

export function createInitialState(id: string, data: Record<string, unknown> = {}): State {
  const now = new Date().toISOString();
  return {
    id,
    type: 'CREATED',
    version: 1,
    createdAt: now,
    updatedAt: now,
    data,
    metadata: { attempts: 0 }
  };
}

export function transitionState(current: State, to: StateType, extraData?: Record<string, unknown>, error?: string): State {
  assertValidTransition(current.type, to);
  
  const now = new Date().toISOString();
  return {
    ...current,
    type: to,
    previousType: current.type,
    version: current.version + 1,
    updatedAt: now,
    data: extraData ? { ...current.data, ...extraData } : current.data,
    metadata: {
      ...current.metadata,
      attempts: to === 'RUNNING' ? current.metadata.attempts + 1 : current.metadata.attempts,
      lastError: error || (to === 'FAILED' ? current.metadata.lastError : undefined),
      completedAt: to === 'COMPLETED' ? now : current.metadata.completedAt,
      blockedReason: to === 'BLOCKED' ? (extraData?.reason as string) || current.metadata.blockedReason : undefined
    }
  };
}

// Invariant: completedTaskCannotExecuteAgain
export function assertNotCompleted(state: State, operation: string): void {
  if (state.type === 'COMPLETED') {
    throw new Error(`[Invariant:completedTaskCannotExecuteAgain] Cannot ${operation} on COMPLETED state ${state.id}`);
  }
}
