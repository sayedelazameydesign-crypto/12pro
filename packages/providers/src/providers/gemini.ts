/**
 * Google Gemini - remote provider.
 *
 * Metered. The credential lives only in the environment; it is never embedded in
 * source and never enters the genome (all `.env*` files are excluded from the
 * fingerprint leaves by policy).
 */
import type { ProviderDescriptor } from '../provider-types.js';

export const geminiProvider: ProviderDescriptor = {
  id: 'gemini',
  displayName: 'Google Gemini',
  transport: 'remote-https',
  local: false,
  baseUrlEnvVar: 'GEMINI_BASE_URL',
  defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
  apiKeyEnvVar: 'GEMINI_API_KEY',
  defaultModel: 'gemini-2.0-flash',
  costTier: 'metered',
  capabilities: ['chat-completion', 'embedding', 'streaming', 'tool-calling', 'vision', 'json-mode'],
  verificationNote:
    'Remote and metered. Blocked while MAX_SPEND=0. Credential is read from GEMINI_API_KEY at call time and is never persisted into any artifact.',
};

export default geminiProvider;
