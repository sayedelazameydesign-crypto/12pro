/**
 * Clock/Context - النواة الذرية: Time + Metadata
 * الزمن والسياق - لا hidden state، كل شيء explicit
 */

export interface Clock {
  now(): string; // ISO timestamp - injectable for deterministic tests
  nowMs(): number;
}

export class SystemClock implements Clock {
  now(): string {
    return new Date().toISOString();
  }
  nowMs(): number {
    return Date.now();
  }
}

export class FixedClock implements Clock {
  constructor(private fixedTime: string, private fixedMs: number) {}
  now(): string { return this.fixedTime; }
  nowMs(): number { return this.fixedMs; }
}

export interface ExecutionContext {
  readonly clock: Clock;
  readonly correlationId: string;
  readonly causationId?: string; // What caused this execution?
  readonly missionId?: string;
  readonly taskId?: string;
  readonly agentId?: string;
  readonly sessionId?: string;
  readonly metadata: Record<string, unknown>;
  readonly budget: {
    readonly maxSpend: number;
    readonly spent: number;
    readonly maxTokens: number;
    readonly tokensUsed: number;
  };
  readonly permissions: {
    readonly allowlist: string[];
    readonly blocklist: string[];
  };
}

export function createExecutionContext(params: Partial<ExecutionContext> & { correlationId: string }): ExecutionContext {
  return {
    clock: params.clock || new SystemClock(),
    correlationId: params.correlationId,
    causationId: params.causationId,
    missionId: params.missionId,
    taskId: params.taskId,
    agentId: params.agentId,
    sessionId: params.sessionId,
    metadata: params.metadata || {},
    budget: params.budget || { maxSpend: 0, spent: 0, maxTokens: 50000, tokensUsed: 0 },
    permissions: params.permissions || { allowlist: [], blocklist: [] }
  };
}

// For deterministic tests
export function createTestContext(correlationId: string, fixedTime = "2026-09-16T07:00:00Z"): ExecutionContext {
  return createExecutionContext({
    correlationId,
    clock: new FixedClock(fixedTime, new Date(fixedTime).getTime()),
    budget: { maxSpend: 0, spent: 0, maxTokens: 50000, tokensUsed: 0 },
    permissions: { allowlist: ["read_file", "browser_navigate"], blocklist: ["rm -rf /", "drop table"] },
    metadata: { test: true }
  });
}
