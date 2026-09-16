/**
 * @agi-system/providers
 *
 * LLM provider routing: Ollama (local), NVIDIA NIM, Google Gemini, Groq and
 * Hugging Face - selected local-first under a hard MAX_SPEND=0 ceiling.
 *
 * Two rules this module exists to enforce:
 *   - a provider's LIVE status is UNKNOWN unless it was actually probed
 *   - a metered provider can never be selected while MAX_SPEND=0
 */

export const PACKAGE_NAME = "@agi-system/providers";
export const VERSION = "0.1.0";

export interface ServiceConfig {
  enabled: boolean;
  timeoutMs?: number;
  maxRetries?: number;
}

export class ProvidersService {
  constructor(private config: ServiceConfig = { enabled: true, timeoutMs: 30000 }) {}

  async init(): Promise<void> {
    console.log(`[${PACKAGE_NAME}] initializing...`);
    // TODO: implement providers initialization with governance checks
  }

  health(): { status: 'ok' | 'degraded' | 'down'; package: string; timestamp: string } {
    return { status: 'ok', package: PACKAGE_NAME, timestamp: new Date().toISOString() };
  }

  async shutdown(): Promise<void> {
    console.log(`[${PACKAGE_NAME}] shutting down...`);
  }
}

export * from "./types.js";
export * from "./provider-types.js";
export * from "./registry.js";
export * from "./spend-policy.js";
export * from "./local-first.js";

export { ollamaProvider } from "./providers/ollama.js";
export { nvidiaProvider } from "./providers/nvidia.js";
export { geminiProvider } from "./providers/gemini.js";
export { groqProvider } from "./providers/groq.js";
export { huggingfaceProvider } from "./providers/huggingface.js";

export default ProvidersService;
