/**
 * Spend policy: MAX_SPEND=0 is a hard ceiling, not a default to be overridden.
 *
 * Under a zero ceiling, any metered provider is blocked. Blocking is explicit and
 * carries a reason, so a caller can never receive a silently-downgraded provider
 * or an accidental paid request.
 */
import type { CostTier, ProviderDescriptor } from './provider-types.js';

export interface SpendPolicy {
  /** Parsed ceiling. `null` when undeclared - undeclared is NOT zero. */
  maxSpend: number | null;
  /** True only when MAX_SPEND is declared AND equals 0. */
  zeroSpendEnforced: boolean;
  declared: boolean;
  source: string | null;
  raw: string | null;
}

/** Parse MAX_SPEND from an env-style map. */
export function readSpendPolicy(env: NodeJS.ProcessEnv = process.env, source = 'process.env'): SpendPolicy {
  const raw = env.MAX_SPEND ?? null;
  if (raw === null || raw.trim() === '') {
    return { maxSpend: null, zeroSpendEnforced: false, declared: false, source: null, raw: null };
  }
  const parsed = Number(raw.trim());
  const ok = Number.isFinite(parsed) && parsed >= 0;
  return {
    maxSpend: ok ? parsed : null,
    // An unparsable or negative ceiling is treated as NOT zero, so it cannot be
    // used to claim a zero-spend posture it does not actually have.
    zeroSpendEnforced: ok && parsed === 0,
    declared: true,
    source,
    raw,
  };
}

export interface AllowDecision {
  allowed: boolean;
  providerId: string;
  costTier: CostTier;
  reason: string;
}

/** Decide whether a provider may be used under the given spend policy. */
export function isProviderAllowed(
  descriptor: ProviderDescriptor,
  policy: SpendPolicy,
): AllowDecision {
  if (descriptor.costTier === 'zero-spend') {
    return {
      allowed: true,
      providerId: descriptor.id,
      costTier: descriptor.costTier,
      reason: 'zero-spend provider - allowed under any ceiling',
    };
  }

  if (!policy.declared) {
    return {
      allowed: false,
      providerId: descriptor.id,
      costTier: descriptor.costTier,
      reason: 'MAX_SPEND is not declared - an undeclared ceiling is not permission to spend',
    };
  }

  if (policy.maxSpend === null) {
    return {
      allowed: false,
      providerId: descriptor.id,
      costTier: descriptor.costTier,
      reason: `MAX_SPEND="${policy.raw}" is not a valid non-negative number - refusing metered provider`,
    };
  }

  if (policy.maxSpend === 0) {
    return {
      allowed: false,
      providerId: descriptor.id,
      costTier: descriptor.costTier,
      reason: 'MAX_SPEND=0 - metered provider blocked by the zero-spend ceiling',
    };
  }

  return {
    allowed: true,
    providerId: descriptor.id,
    costTier: descriptor.costTier,
    reason: `MAX_SPEND=${policy.maxSpend} permits metered usage`,
  };
}

/** Evaluate every provider against the policy. Nothing is omitted from the result. */
export function evaluateSpendPolicy(
  providers: readonly ProviderDescriptor[],
  policy: SpendPolicy,
): { policy: SpendPolicy; decisions: AllowDecision[]; allowedIds: string[]; blockedIds: string[] } {
  const decisions = providers.map((p) => isProviderAllowed(p, policy));
  return {
    policy,
    decisions,
    allowedIds: decisions.filter((d) => d.allowed).map((d) => d.providerId).sort(),
    blockedIds: decisions.filter((d) => !d.allowed).map((d) => d.providerId).sort(),
  };
}
