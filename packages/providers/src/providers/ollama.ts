/**
 * Ollama - local provider.
 *
 * This is the local-first anchor of the provider layer: it runs on the same
 * machine, sends no data out, needs no credential, and costs nothing. Under a
 * MAX_SPEND=0 policy it is the only provider that can be selected unconditionally.
 *
 * Its live status is still UNKNOWN unless a probe actually contacted the daemon -
 * being local does not imply being up.
 */
import type { ProviderDescriptor } from '../provider-types.js';

export const ollamaProvider: ProviderDescriptor = {
  id: 'ollama',
  displayName: 'Ollama (local)',
  transport: 'local-http',
  local: true,
  baseUrlEnvVar: 'OLLAMA_BASE_URL',
  defaultBaseUrl: 'http://localhost:11434',
  apiKeyEnvVar: null,
  defaultModel: 'llama3.2:latest',
  costTier: 'zero-spend',
  capabilities: ['chat-completion', 'embedding', 'streaming', 'tool-calling', 'json-mode'],
  verificationNote:
    'Local daemon. No credential and no egress. Reachability is UNKNOWN unless AGI_ALLOW_LIVE_PROBE=1 and the daemon actually answered.',
};

/** Environment variable that selects the embedding model. */
export const OLLAMA_EMBED_MODEL_ENV = 'OLLAMA_EMBED_MODEL';

export default ollamaProvider;
