/**
 * Provider descriptors and runtime status.
 *
 * The central honesty rule of this layer:
 *
 *   A provider's live status is UNKNOWN unless it was ACTUALLY probed.
 *
 * `probeStatus` therefore starts at 'UNKNOWN' and can only move to 'REACHABLE' or
 * 'UNREACHABLE' through `probeProvider`, which performs a real network request and
 * records when it happened, who triggered it, and what the response was. Nothing in
 * this package is allowed to assert reachability from configuration alone, and no
 * certification artifact may report a provider as verified without that evidence.
 */

export type ProviderId = 'ollama' | 'nvidia' | 'gemini' | 'groq' | 'huggingface';

/** How the provider is reached. Local providers never leave the machine. */
export type ProviderTransport = 'local-http' | 'remote-https';

/** Cost posture. `zero-spend` means usable under a MAX_SPEND=0 policy. */
export type CostTier = 'zero-spend' | 'metered';

/**
 * Live status. UNKNOWN is the ONLY default and the only honest value for a
 * provider that has never actually been contacted in this environment.
 */
export type ProbeStatus = 'UNKNOWN' | 'REACHABLE' | 'UNREACHABLE';

export type ProviderCapability =
  | 'chat-completion'
  | 'embedding'
  | 'streaming'
  | 'tool-calling'
  | 'vision'
  | 'json-mode';

export interface ProviderDescriptor {
  id: ProviderId;
  displayName: string;
  transport: ProviderTransport;
  /** True when the provider runs on this machine and sends no data out. */
  local: boolean;
  /** Environment variable holding the base URL, if configurable. */
  baseUrlEnvVar: string | null;
  /** Default base URL. Local providers point at loopback. */
  defaultBaseUrl: string;
  /** Environment variable holding the credential, or null when none is needed. */
  apiKeyEnvVar: string | null;
  defaultModel: string;
  costTier: CostTier;
  capabilities: ProviderCapability[];
  /** Human-readable note about what is and is not verified. */
  verificationNote: string;
}

export interface ProviderRuntimeStatus {
  providerId: ProviderId;
  /** UNKNOWN until a real probe has been performed. */
  probeStatus: ProbeStatus;
  lastProbedAt: string | null;
  /** What triggered the probe, so the evidence is attributable. */
  probedBy: string | null;
  /** HTTP status or error text observed during the probe. */
  observed: string | null;
  latencyMs: number | null;
}

/** The status every provider starts in. Never REACHABLE by default. */
export function unknownStatus(providerId: ProviderId): ProviderRuntimeStatus {
  return {
    providerId,
    probeStatus: 'UNKNOWN',
    lastProbedAt: null,
    probedBy: null,
    observed: null,
    latencyMs: null,
  };
}

export interface ProbeOptions {
  /**
   * Live network probes are OFF by default. Set AGI_ALLOW_LIVE_PROBE=1 to permit
   * them. Without it, `probeProvider` returns UNKNOWN and says why - it never
   * guesses, and never reports a provider as reachable from config alone.
   */
  allowLive?: boolean;
  timeoutMs?: number;
  actor?: string;
}

export interface ProbeResult extends ProviderRuntimeStatus {
  /** Why the status is what it is. Always populated. */
  reason: string;
  /** True only when a real request was made and answered. */
  actuallyTested: boolean;
}

/**
 * Probe a provider.
 *
 * Returns UNKNOWN (with a reason) when live probing is not permitted or when no
 * credential/base URL is configured. Performs a real HTTP GET otherwise and maps
 * the outcome to REACHABLE / UNREACHABLE.
 */
export async function probeProvider(
  descriptor: ProviderDescriptor,
  env: NodeJS.ProcessEnv = process.env,
  options: ProbeOptions = {},
): Promise<ProbeResult> {
  const allowLive = options.allowLive ?? env.AGI_ALLOW_LIVE_PROBE === '1';
  const actor = options.actor ?? 'probeProvider';
  const timeoutMs = options.timeoutMs ?? 5000;

  const base = unknownStatus(descriptor.id);

  if (!allowLive) {
    return {
      ...base,
      reason:
        'live probing disabled (AGI_ALLOW_LIVE_PROBE != 1) - status stays UNKNOWN rather than being inferred from configuration',
      actuallyTested: false,
    };
  }

  if (descriptor.apiKeyEnvVar && !env[descriptor.apiKeyEnvVar]) {
    return {
      ...base,
      reason: `${descriptor.apiKeyEnvVar} is not set - cannot contact ${descriptor.id} without a credential`,
      actuallyTested: false,
    };
  }

  const baseUrl = descriptor.baseUrlEnvVar ? env[descriptor.baseUrlEnvVar] || descriptor.defaultBaseUrl : descriptor.defaultBaseUrl;

  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(baseUrl, { signal: controller.signal, redirect: 'manual' });
    const latencyMs = Date.now() - started;
    // Any HTTP response proves the endpoint answered, including 4xx.
    return {
      providerId: descriptor.id,
      probeStatus: 'REACHABLE',
      lastProbedAt: new Date().toISOString(),
      probedBy: actor,
      observed: `HTTP ${response.status}`,
      latencyMs,
      reason: `${baseUrl} answered with HTTP ${response.status} in ${latencyMs}ms`,
      actuallyTested: true,
    };
  } catch (err) {
    return {
      providerId: descriptor.id,
      probeStatus: 'UNREACHABLE',
      lastProbedAt: new Date().toISOString(),
      probedBy: actor,
      observed: (err as Error).name === 'AbortError' ? `timeout after ${timeoutMs}ms` : (err as Error).message,
      latencyMs: Date.now() - started,
      reason: `${baseUrl} did not answer: ${(err as Error).message}`,
      actuallyTested: true,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** True when the status was produced by a real test rather than assumed. */
export function statusIsTested(status: ProviderRuntimeStatus): boolean {
  return status.probeStatus !== 'UNKNOWN' && status.lastProbedAt !== null;
}
