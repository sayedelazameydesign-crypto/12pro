/**
 * Local-first provider selection.
 *
 * Ordering rule:
 *   1. local providers first (no credential, no egress, no cost)
 *   2. then zero-spend remote providers
 *   3. then metered providers - only if the spend ceiling permits, which under
 *      MAX_SPEND=0 it never does
 *
 * Within a tier, ordering is by id so selection is deterministic and reproducible.
 * A selection that finds nothing allowed returns an explicit refusal with reasons
 * rather than falling back to something the policy forbade.
 */
import type { ProviderDescriptor, ProviderCapability } from './provider-types.js';
import { isProviderAllowed, readSpendPolicy } from './spend-policy.js';
import type { SpendPolicy } from './spend-policy.js';

/** Lower number = higher priority. */
export function priorityTier(descriptor: ProviderDescriptor, policy: SpendPolicy): number {
  const decision = isProviderAllowed(descriptor, policy);
  if (!decision.allowed) return Number.POSITIVE_INFINITY;
  if (descriptor.local) return 0;
  if (descriptor.costTier === 'zero-spend') return 1;
  return 2;
}

/** Sort providers into local-first order under the given policy. */
export function orderByLocalFirst(
  providers: readonly ProviderDescriptor[],
  policy: SpendPolicy,
): ProviderDescriptor[] {
  return [...providers].sort((a, b) => {
    const ta = priorityTier(a, policy);
    const tb = priorityTier(b, policy);
    if (ta !== tb) return ta - tb;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

export interface SelectionRequest {
  /** Capabilities the caller needs. Empty means "any". */
  requires?: ProviderCapability[];
  /** Require a local provider (no egress). */
  localOnly?: boolean;
}

export interface SelectionResult {
  selected: ProviderDescriptor | null;
  /** Candidates in local-first order, allowed ones first. */
  order: ProviderDescriptor[];
  /** Per-provider verdict, so a refusal is fully explainable. */
  evaluations: { providerId: string; allowed: boolean; tier: number; capabilitiesSatisfied: boolean; reason: string }[];
  reason: string;
}

/** Select a provider, or refuse explicitly. */
export function selectProvider(
  providers: readonly ProviderDescriptor[],
  request: SelectionRequest = {},
  policy: SpendPolicy = readSpendPolicy(),
): SelectionResult {
  const requires = request.requires ?? [];
  const order = orderByLocalFirst(providers, policy);

  const evaluations = order.map((descriptor) => {
    const decision = isProviderAllowed(descriptor, policy);
    const tier = priorityTier(descriptor, policy);
    const capabilitiesSatisfied = requires.every((c) => descriptor.capabilities.includes(c));

    let reason = decision.reason;
    if (request.localOnly && !descriptor.local) {
      reason = 'localOnly requested - remote provider skipped';
    } else if (!capabilitiesSatisfied) {
      reason = `missing capability: ${requires.filter((c) => !descriptor.capabilities.includes(c)).join(', ')}`;
    }

    return {
      providerId: descriptor.id,
      allowed:
        decision.allowed &&
        capabilitiesSatisfied &&
        (!request.localOnly || descriptor.local),
      tier,
      capabilitiesSatisfied,
      reason,
    };
  });

  const winner = evaluations.find((e) => e.allowed);
  const selected = winner ? order.find((p) => p.id === winner.providerId) ?? null : null;

  return {
    selected,
    order,
    evaluations,
    reason: selected
      ? `selected ${selected.id} (tier ${winner?.tier}, ${selected.local ? 'local' : 'remote'}, ${selected.costTier})`
      : `no provider satisfies the request under MAX_SPEND=${policy.maxSpend ?? 'undeclared'}: ${evaluations
          .map((e) => `${e.providerId}(${e.reason})`)
          .join('; ')}`,
  };
}
