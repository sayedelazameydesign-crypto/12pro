/**
 * Groq - remote provider (low-latency inference).
 *
 * Metered, therefore blocked under MAX_SPEND=0. Declared so the provider surface
 * in the genome is complete and the blocking is visible rather than implicit.
 */
import type { ProviderDescriptor } from '../provider-types.js';

export const groqProvider: ProviderDescriptor = {
  id: 'groq',
  displayName: 'Groq',
  transport: 'remote-https',
  local: false,
  baseUrlEnvVar: 'GROQ_BASE_URL',
  defaultBaseUrl: 'https://api.groq.com/openai/v1',
  apiKeyEnvVar: 'GROQ_API_KEY',
  defaultModel: 'llama-3.3-70b-versatile',
  costTier: 'metered',
  capabilities: ['chat-completion', 'streaming', 'tool-calling', 'json-mode'],
  verificationNote:
    'Remote and metered. Blocked while MAX_SPEND=0. Live status UNKNOWN unless probed with a real credential.',
};

export default groqProvider;
