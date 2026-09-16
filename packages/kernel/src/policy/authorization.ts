/**
 * Authorization - النواة الذرية: Policy Enforcement
 * تجميع كل Policies - Decision = f(currentState, command, policy, context) - Deterministic Core
 */

import type { Command } from '../commands/command.js';
import type { ExecutionContext } from '../context/execution-context.js';
import type { State } from '../state/machine.js';
import type { Policy, PolicyDecision } from './policy.js';
import { MaxSpendPolicy, AllowlistPolicy, DangerousToolPolicy, StatePolicy, ApprovalPolicy } from './policy.js';
import { PolicyDeniedError, CoreError } from '../errors/core-error.js';

export interface AuthorizationResult {
  readonly allowed: boolean;
  readonly needsApproval: boolean;
  readonly decisions: PolicyDecision[];
  readonly reason: string;
}

export class Authorizer {
  private policies: Policy[];

  constructor(policies?: Policy[]) {
    // Default policies - النواة تفرض القواعد غير القابلة للتجاوز
    this.policies = policies || [
      new StatePolicy(),
      new MaxSpendPolicy(),
      new AllowlistPolicy(),
      new DangerousToolPolicy(),
      new ApprovalPolicy()
    ];
  }

  async authorize(command: Command, context: ExecutionContext, state?: State | null): Promise<AuthorizationResult> {
    const decisions: PolicyDecision[] = [];

    for (const policy of this.policies) {
      const decision = await policy.evaluate(command, context, state);
      decisions.push(decision);

      // Invariant: deniedActionCannotReachExecutor
      if (decision.type === 'DENY') {
        return {
          allowed: false,
          needsApproval: false,
          decisions,
          reason: decision.reason
        };
      }

      if (decision.type === 'NEEDS_APPROVAL') {
        return {
          allowed: false,
          needsApproval: true,
          decisions,
          reason: decision.reason
        };
      }
    }

    return {
      allowed: true,
      needsApproval: false,
      decisions,
      reason: 'All policies ALLOW'
    };
  }

  addPolicy(policy: Policy): void {
    this.policies.push(policy);
  }
}

// Deterministic decision function - نفس المدخلات + نفس الحالة + نفس القواعد = نفس القرار
export async function decide(
  currentState: State | null,
  command: Command,
  context: ExecutionContext,
  policies?: Policy[]
): Promise<AuthorizationResult> {
  const authorizer = new Authorizer(policies);
  return authorizer.authorize(command, context, currentState);
}
