import { BaseProvider } from './base.js';
import type { ProviderHealth, ProviderRequest, ProviderResponse, ProviderName } from '../types.js';

export class GroqProvider extends BaseProvider {
  readonly name: ProviderName = 'groq';
  readonly isLocal = false;
  private apiKey?: string;
  private availableModelsCache = ['llama-3.1-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'];

  constructor(apiKey?: string) {
    super();
    this.apiKey = apiKey || process.env.GROQ_API_KEY;
  }

  getAvailableModels(): string[] {
    return this.availableModelsCache;
  }

  async checkHealth(): Promise<ProviderHealth> {
    const start = Date.now();
    if (!this.apiKey) {
      return this.createHealth('degraded', Date.now() - start, 'GROQ_API_KEY not configured');
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
    if (!this.apiKey) throw new Error('Groq API key not configured');

    const model = request.taskType === 'coding' ? 'llama-3.1-70b-versatile' : 'llama-3.1-8b-instant';
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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
        throw new Error(`Groq API error ${res.status}: ${txt}`);
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
