/**
 * Provider registry.
 *
 * The registry is the single enumerated source of truth for the provider surface.
 * The genetic genome reads it, the spend policy consults it, and local-first
 * ordering is computed from it - so a provider cannot exist in one place and be
 * silently missing from another.
 */
import type { ProviderDescriptor, ProviderId, ProviderRuntimeStatus } from './provider-types.js';
import { unknownStatus } from './provider-types.js';
import { ollamaProvider } from './providers/ollama.js';
import { nvidiaProvider } from './providers/nvidia.js';
import { geminiProvider } from './providers/gemini.js';
import { groqProvider } from './providers/groq.js';
import { huggingfaceProvider } from './providers/huggingface.js';

/** Every provider the system knows about, in declaration order. */
export const PROVIDERS: readonly ProviderDescriptor[] = [
  ollamaProvider,
  nvidiaProvider,
  geminiProvider,
  groqProvider,
  huggingfaceProvider,
];

/** Stable id list, sorted. Used by the genome and by reports. */
export const PROVIDER_IDS: readonly ProviderId[] = [...PROVIDERS.map((p) => p.id)].sort();

/** Local providers - the only ones usable with no credential and no egress. */
export const LOCAL_PROVIDERS: readonly ProviderDescriptor[] = PROVIDERS.filter((p) => p.local);

/** Remote providers. */
export const REMOTE_PROVIDERS: readonly ProviderDescriptor[] = PROVIDERS.filter((p) => !p.local);

/** Look a provider up by id. */
export function getProvider(id: string): ProviderDescriptor | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

/**
 * Runtime status for every provider.
 *
 * All entries start UNKNOWN. This snapshot is what certification reports, so a
 * report generated without probing truthfully says every live provider is UNKNOWN.
 */
export function initialRuntimeStatuses(): Record<string, ProviderRuntimeStatus> {
  const out: Record<string, ProviderRuntimeStatus> = {};
  for (const provider of PROVIDERS) {
    out[provider.id] = unknownStatus(provider.id);
  }
  return out;
}

/** Summary safe to embed in a certification artifact: no credentials, no guesses. */
export function providerSurfaceSummary(statuses: Record<string, ProviderRuntimeStatus> = initialRuntimeStatuses()): {
  count: number;
  ids: string[];
  localIds: string[];
  remoteIds: string[];
  meteredIds: string[];
  zeroSpendIds: string[];
  liveStatus: Record<string, string>;
  /** True when not a single provider was actually contacted. */
  mockOnly: boolean;
  note: string;
} {
  const liveStatus: Record<string, string> = {};
  let tested = 0;
  for (const provider of PROVIDERS) {
    const status = statuses[provider.id];
    liveStatus[provider.id] = status ? status.probeStatus : 'UNKNOWN';
    if (status && status.probeStatus !== 'UNKNOWN') tested += 1;
  }

  return {
    count: PROVIDERS.length,
    ids: [...PROVIDER_IDS],
    localIds: LOCAL_PROVIDERS.map((p) => p.id),
    remoteIds: REMOTE_PROVIDERS.map((p) => p.id),
    meteredIds: PROVIDERS.filter((p) => p.costTier === 'metered')
      .map((p) => p.id)
      .sort(),
    zeroSpendIds: PROVIDERS.filter((p) => p.costTier === 'zero-spend')
      .map((p) => p.id)
      .sort(),
    liveStatus,
    mockOnly: tested === 0,
    note:
      tested === 0
        ? `MOCK-ONLY: none of the ${PROVIDERS.length} providers was actually contacted, so every live status is UNKNOWN. No provider may be reported as verified.`
        : `${tested} of ${PROVIDERS.length} providers were actually probed; the rest remain UNKNOWN.`,
  };
}
