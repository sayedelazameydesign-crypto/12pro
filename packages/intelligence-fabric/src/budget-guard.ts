/**
 * Budget Guard - Enforces MAX_SPEND=0
 * No paid API calls allowed without explicit approval
 */

import type { CostGuardPolicy, ProviderName, ProviderDecision } from './types.js';

export class BudgetGuard {
  private policy: CostGuardPolicy;
  private dailyUsage: Map<ProviderName, number> = new Map();
  private totalSpend = 0;

  constructor(policy?: Partial<CostGuardPolicy>) {
    this.policy = {
      maxSpendUsd: 0,
      localFirst: true,
      blockUnknownCost: true,
      blockPaid: true,
      allowedProviders: ['ollama', 'gemini', 'nvidia', 'groq', 'huggingface'],
      dailyFreeQuota: {
        ollama: Infinity, // local = unlimited free
        gemini: 1500,
        nvidia: 1000,
        groq: 1000,
        huggingface: 100
      },
      ...policy
    };
  }

  /**
   * Check if a provider decision is allowed under budget policy
   */
  check(decision: ProviderDecision): { allowed: boolean; reason: string } {
    // Rule 1: If estimated cost > 0 and maxSpend is 0, deny
    if (decision.estimatedCost > this.policy.maxSpendUsd) {
      return {
        allowed: false,
        reason: `Cost $${decision.estimatedCost} exceeds MAX_SPEND $${this.policy.maxSpendUsd}. Provider ${decision.provider} blocked by Budget Guard.`
      };
    }

    // Rule 2: Block unknown cost if policy says so
    if (this.policy.blockUnknownCost && decision.estimatedCost === undefined) {
      return {
        allowed: false,
        reason: `Unknown cost for provider ${decision.provider} blocked. Policy: blockUnknownCost=true`
      };
    }

    // Rule 3: Check if provider is allowed
    if (!this.policy.allowedProviders.includes(decision.provider)) {
      return {
        allowed: false,
        reason: `Provider ${decision.provider} not in allowed list: ${this.policy.allowedProviders.join(', ')}`
      };
    }

    // Rule 4: Check daily quota for free tier
    const dailyLimit = this.policy.dailyFreeQuota[decision.provider];
    const currentUsage = this.dailyUsage.get(decision.provider) || 0;
    if (dailyLimit !== Infinity && currentUsage >= dailyLimit) {
      return {
        allowed: false,
        reason: `Daily quota exceeded for ${decision.provider}: ${currentUsage}/${dailyLimit}`
      };
    }

    // Rule 5: Local-first check - if local provider available and healthy, prefer it
    // This is enforced at router level, but we log it here
    if (this.policy.localFirst && decision.provider !== 'ollama') {
      // Allow but log that local was not used
      console.log(`[budget-guard] Non-local provider ${decision.provider} used, localFirst=true but fallback allowed`);
    }

    return { allowed: true, reason: 'Allowed by Budget Guard' };
  }

  /**
   * Record usage for quota tracking
   */
  recordUsage(provider: ProviderName, cost: number): void {
    const current = this.dailyUsage.get(provider) || 0;
    this.dailyUsage.set(provider, current + 1);
    this.totalSpend += cost;

    if (this.totalSpend > this.policy.maxSpendUsd) {
      console.error(`[budget-guard] CRITICAL: Total spend $${this.totalSpend} exceeded MAX_SPEND $${this.policy.maxSpendUsd}`);
    }
  }

  /**
   * Reset daily quotas (call daily)
   */
  resetDaily(): void {
    this.dailyUsage.clear();
    console.log('[budget-guard] Daily quotas reset');
  }

  getStatus(): { totalSpend: number; maxSpend: number; dailyUsage: Record<string, number>; policy: CostGuardPolicy } {
    const usage: Record<string, number> = {};
    for (const [k, v] of this.dailyUsage.entries()) {
      usage[k] = v;
    }
    return {
      totalSpend: this.totalSpend,
      maxSpend: this.policy.maxSpendUsd,
      dailyUsage: usage,
      policy: this.policy
    };
  }

  /**
   * Validate that a provider's cost is known and zero
   */
  validateCost(provider: ProviderName, cost: number, isFreeTier: boolean): boolean {
    if (cost > 0) {
      if (this.policy.blockPaid) {
        return false;
      }
      if (this.policy.maxSpendUsd === 0) {
        return false;
      }
    }
    if (isFreeTier && cost === 0) return true;
    if (provider === 'ollama' && cost === 0) return true;
    if (cost === 0) return true;
    return false;
  }
}

export const budgetGuard = new BudgetGuard();
export default BudgetGuard;
