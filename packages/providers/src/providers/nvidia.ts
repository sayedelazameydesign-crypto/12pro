/**
 * NVIDIA NIM - remote provider.
 *
 * Metered: using it can incur cost, so under MAX_SPEND=0 it is blocked by the
 * spend policy and never selected. It is declared here because the genome must
 * describe the provider surface honestly, including the parts that policy forbids.
 */
import type { ProviderDescriptor } from '../provider-types.js';

export const nvidiaProvider: ProviderDescriptor = {
  id: 'nvidia',
  displayName: 'NVIDIA NIM',
  transport: 'remote-https',
  local: false,
  baseUrlEnvVar: 'NVIDIA_BASE_URL',
  defaultBaseUrl: 'https://integrate.api.nvidia.com/v1',
  apiKeyEnvVar: 'NVIDIA_API_KEY',
  defaultModel: 'meta/llama-3.1-70b-instruct',
  costTier: 'metered',
  capabilities: ['chat-completion', 'streaming', 'tool-calling', 'json-mode'],
  verificationNote:
    'Remote and metered. Blocked while MAX_SPEND=0. Live status UNKNOWN unless probed with a real credential.',
};

export default nvidiaProvider;
