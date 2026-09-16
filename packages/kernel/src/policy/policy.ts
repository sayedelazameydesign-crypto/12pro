/**
 * Policy - النواة الذرية: Is it allowed?
 * هل العملية مسموحة أم مرفوضة أم تحتاج موافقة - سلطة القواعد غير القابلة للتجاوز
 */

import type { Command } from '../commands/command.js';
import type { ExecutionContext } from '../context/execution-context.js';
import type { State } from '../state/machine.js';

export type PolicyDecisionType = 'ALLOW' | 'DENY' | 'NEEDS_APPROVAL';

export interface PolicyDecision {
  readonly type: PolicyDecisionType;
  readonly reason: string;
  readonly commandId: string;
  readonly timestamp: string;
  readonly metadata?: Record<string, unknown>;
}

export interface Policy {
  readonly name: string;
  evaluate(command: Command, context: ExecutionContext, state?: State | null): Promise<PolicyDecision>;
}

// Built-in policies - Atomic primitives

export class MaxSpendPolicy implements Policy {
  readonly name = 'MaxSpendPolicy';

  async evaluate(command: Command, context: ExecutionContext): Promise<PolicyDecision> {
    const maxSpend = context.budget.maxSpend;
    const spent = context.budget.spent;
    const requested = (command.payload.cost as number) || 0;

    // Invariant: MAX_SPEND === 0 by default
    if (spent + requested > maxSpend) {
      return {
        type: 'DENY',
        reason: `Budget exceeded: spent ${spent} + requested ${requested} > max ${maxSpend}`,
        commandId: command.id,
        timestamp: context.clock.now(),
        metadata: { maxSpend, spent, requested }
      };
    }

    return {
      type: 'ALLOW',
      reason: 'Budget check passed',
      commandId: command.id,
      timestamp: context.clock.now()
    };
  }
}

export class AllowlistPolicy implements Policy {
  readonly name = 'AllowlistPolicy';

  async evaluate(command: Command, context: ExecutionContext): Promise<PolicyDecision> {
    if (command.type !== 'EXECUTE_TOOL') {
      return { type: 'ALLOW', reason: 'Not a tool execution', commandId: command.id, timestamp: context.clock.now() };
    }

    const tool = command.payload.tool as string;
    const allowlist = context.permissions.allowlist;
    const blocklist = context.permissions.blocklist;

    if (blocklist.includes(tool)) {
      return {
        type: 'DENY',
        reason: `Tool ${tool} is in blocklist`,
        commandId: command.id,
        timestamp: context.clock.now(),
        metadata: { tool, blocklist }
      };
    }

    if (allowlist.length > 0 && !allowlist.includes(tool)) {
      return {
        type: 'DENY',
        reason: `Tool ${tool} not in allowlist`,
        commandId: command.id,
        timestamp: context.clock.now(),
        metadata: { tool, allowlist }
      };
    }

    return {
      type: 'ALLOW',
      reason: `Tool ${tool} allowed`,
      commandId: command.id,
      timestamp: context.clock.now()
    };
  }
}

export class DangerousToolPolicy implements Policy {
  readonly name = 'DangerousToolPolicy';
  private dangerousPatterns = ['rm -rf', 'drop table', 'curl | sh', 'wget | sh', 'mkfs', ':(){:|:&};:'];

  async evaluate(command: Command, context: ExecutionContext): Promise<PolicyDecision> {
    const payloadStr = JSON.stringify(command.payload).toLowerCase();
    
    for (const pattern of this.dangerousPatterns) {
      if (payloadStr.includes(pattern)) {
        return {
          type: 'DENY',
          reason: `Dangerous pattern detected: ${pattern}`,
          commandId: command.id,
          timestamp: context.clock.now(),
          metadata: { pattern, payload: command.payload }
        };
      }
    }

    return {
      type: 'ALLOW',
      reason: 'No dangerous pattern',
      commandId: command.id,
      timestamp: context.clock.now()
    };
  }
}

export class StatePolicy implements Policy {
  readonly name = 'StatePolicy';

  async evaluate(command: Command, context: ExecutionContext, state?: State | null): Promise<PolicyDecision> {
    if (!state) {
      // No state - only CREATE allowed
      if (command.type === 'CREATE_MISSION' || command.type === 'CREATE_TASK') {
        return { type: 'ALLOW', reason: 'No state, creation allowed', commandId: command.id, timestamp: context.clock.now() };
      }
      return { type: 'DENY', reason: 'No state found for non-creation command', commandId: command.id, timestamp: context.clock.now() };
    }

    // Invariant: completedTaskCannotExecuteAgain
    if (state.type === 'COMPLETED' && (command.type === 'START_TASK' || command.type === 'EXECUTE_TOOL')) {
      return {
        type: 'DENY',
        reason: `Cannot execute on COMPLETED state ${state.id}`,
        commandId: command.id,
        timestamp: context.clock.now(),
        metadata: { state: state.type }
      };
    }

    if (state.type === 'CANCELLED') {
      return {
        type: 'DENY',
        reason: `Cannot execute on CANCELLED state ${state.id}`,
        commandId: command.id,
        timestamp: context.clock.now()
      };
    }

    return { type: 'ALLOW', reason: 'State check passed', commandId: command.id, timestamp: context.clock.now() };
  }
}

export class ApprovalPolicy implements Policy {
  readonly name = 'ApprovalPolicy';
  constructor(private threshold: number = 100000) {}

  async evaluate(command: Command, context: ExecutionContext): Promise<PolicyDecision> {
    const tokensRequested = (command.payload.tokens as number) || 0;
    
    if (tokensRequested > this.threshold) {
      return {
        type: 'NEEDS_APPROVAL',
        reason: `Tokens ${tokensRequested} exceeds approval threshold ${this.threshold}`,
        commandId: command.id,
        timestamp: context.clock.now(),
        metadata: { tokensRequested, threshold: this.threshold }
      };
    }

    return { type: 'ALLOW', reason: 'Below approval threshold', commandId: command.id, timestamp: context.clock.now() };
  }
}
