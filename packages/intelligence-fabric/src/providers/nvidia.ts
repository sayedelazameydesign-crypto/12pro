import { BaseProvider } from './base.js';
import type { ProviderHealth, ProviderRequest, ProviderResponse, ProviderName } from '../types.js';

export class NvidiaProvider extends BaseProvider {
  readonly name: ProviderName = 'nvidia';
  readonly isLocal = false;
  private apiKey?: string;
  private endpoint = 'https://integrate.api.nvidia.com/v1';
  private availableModelsCache = ['meta/llama-3.1-405b-instruct', 'meta/llama-3.1-70b-instruct', 'mistralai/mixtral-8x22b-instruct-v0.1'];

  constructor(apiKey?: string) {
    super();
    this.apiKey = apiKey || process.env.NVIDIA_API_KEY;
  }

  getAvailableModels(): string[] {
    return this.availableModelsCache;
  }

  async checkHealth(): Promise<ProviderHealth> {
    const start = Date.now();
    if (!this.apiKey) {
      return this.createHealth('degraded', Date.now() - start, 'NVIDIA_API_KEY not configured');
    }
    return {
      provider: this.name,
      status: 'healthy',
      latencyMs: Date.now() - start,
      lastCheck: new Date().toISOString(),
      availableModels: this.availableModelsCache,
      isLocal: false
    };
  }

  async complete(request: ProviderRequest): Promise<ProviderResponse> {
    const start = Date.now();
    if (!this.apiKey) throw new Error('NVIDIA API key not configured');
    
    const model = 'meta/llama-3.1-70b-instruct';
    try {
      const res = await fetch(`${this.endpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [
            ...(request.systemPrompt ? [{ role: 'system', content: request.systemPrompt }] : []),
            { role: 'user', content: request.prompt }
          ],
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxTokens ?? 2048
        })
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`NVIDIA API error ${res.status}: ${txt}`);
      }

      const data = await res.json() as any;
      const content = data.choices?.[0]?.message?.content || '';
      const usage = data.usage || {};
      return {
        provider: this.name,
        model,
        content,
        tokensUsed: {
          input: usage.prompt_tokens || this.estimateTokens(request.prompt),
          output: usage.completion_tokens || this.estimateTokens(content),
          total: usage.total_tokens || 0
        },
        latencyMs: Date.now() - start,
        cost: 0,
        finishReason: 'stop',
        timestamp: new Date().toISOString()
      };
    } catch (e) {
      throw e;
    }
  }
}
