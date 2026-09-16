import { BaseProvider } from './base.js';
import type { ProviderHealth, ProviderRequest, ProviderResponse, ProviderName } from '../types.js';

export class GeminiProvider extends BaseProvider {
  readonly name: ProviderName = 'gemini';
  readonly isLocal = false;
  private apiKey?: string;
  private availableModelsCache = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'text-embedding-004'];

  constructor(apiKey?: string) {
    super();
    this.apiKey = apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  }

  getAvailableModels(): string[] {
    return this.availableModelsCache;
  }

  async checkHealth(): Promise<ProviderHealth> {
    const start = Date.now();
    if (!this.apiKey) {
      return this.createHealth('degraded', Date.now() - start, 'GEMINI_API_KEY not configured - free tier not available');
    }
    try {
      // In real impl: fetch https://generativelanguage.googleapis.com/v1beta/models?key=...
      // For now, if key exists, assume healthy
      return {
        provider: this.name,
        status: 'healthy',
        latencyMs: Date.now() - start,
        lastCheck: new Date().toISOString(),
        availableModels: this.availableModelsCache,
        isLocal: false,
        quotaRemaining: 1500 // Free tier daily limit example
      };
    } catch (e) {
      return this.createHealth('down', Date.now() - start, String(e));
    }
  }

  async complete(request: ProviderRequest): Promise<ProviderResponse> {
    const start = Date.now();
    const model = request.requiresVision ? 'gemini-2.5-flash' : 'gemini-2.5-flash';

    if (!this.apiKey) {
      // No key - return error response that will trigger fallback
      throw new Error('Gemini API key not configured');
    }

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;
      const body = {
        contents: [{ parts: [{ text: request.systemPrompt ? `${request.systemPrompt}\n\n${request.prompt}` : request.prompt }] }],
        generationConfig: {
          temperature: request.temperature ?? 0.7,
          maxOutputTokens: request.maxTokens ?? 2048
        }
      };

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal
        });
        clearTimeout(timeout);

        if (res.ok) {
          const data = await res.json() as any;
          const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          const usage = data.usageMetadata || {};
          return {
            provider: this.name,
            model,
            content,
            tokensUsed: {
              input: usage.promptTokenCount || this.estimateTokens(request.prompt),
              output: usage.candidatesTokenCount || this.estimateTokens(content),
              total: usage.totalTokenCount || 0
            },
            latencyMs: Date.now() - start,
            cost: 0, // Free tier
            finishReason: 'stop',
            timestamp: new Date().toISOString()
          };
        } else {
          const errText = await res.text();
          if (res.status === 429) {
            throw new Error(`Gemini quota exceeded: ${errText}`);
          }
          throw new Error(`Gemini API error ${res.status}: ${errText}`);
        }
      } catch (e) {
        clearTimeout(timeout);
        throw e;
      }
    } catch (e) {
      // If quota or error, throw to trigger fallback
      throw e;
    }
  }
}
