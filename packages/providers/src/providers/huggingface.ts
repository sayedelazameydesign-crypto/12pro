/**
 * Hugging Face - remote provider (Inference API / dedicated endpoints).
 *
 * Metered. HF_TOKEN is read from the environment at call time only.
 */
import type { ProviderDescriptor } from '../provider-types.js';

export const huggingfaceProvider: ProviderDescriptor = {
  id: 'huggingface',
  displayName: 'Hugging Face Inference',
  transport: 'remote-https',
  local: false,
  baseUrlEnvVar: 'HF_BASE_URL',
  defaultBaseUrl: 'https://api-inference.huggingface.co',
  apiKeyEnvVar: 'HF_TOKEN',
  defaultModel: 'meta-llama/Llama-3.1-8B-Instruct',
  costTier: 'metered',
  capabilities: ['chat-completion', 'embedding', 'streaming', 'vision'],
  verificationNote:
    'Remote and metered. Blocked while MAX_SPEND=0. HF_TOKEN is never written into the genome or any certification artifact.',
};

export default huggingfaceProvider;
