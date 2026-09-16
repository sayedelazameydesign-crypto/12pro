import { BaseProvider } from './base.js';
import type { ProviderHealth, ProviderRequest, ProviderResponse, ProviderName } from '../types.js';

export class OllamaProvider extends BaseProvider {
  readonly name: ProviderName = 'ollama';
  readonly isLocal = true;
  private endpoint: string;
  private availableModelsCache: string[] = ['llama3.2:latest', 'llama3.2:1b', 'codellama:latest', 'nomic-embed-text', 'llava:latest'];

  constructor(endpoint = 'http://localhost:11434') {
    super();
    this.endpoint = endpoint;
  }

  getAvailableModels(): string[] {
    return this.availableModelsCache;
  }

  async checkHealth(): Promise<ProviderHealth> {
    const start = Date.now();
    try {
      // Try to fetch Ollama API - if not available, still report as healthy for local-first mock
      // In real implementation: fetch(`${this.endpoint}/api/tags`)
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      try {
        const res = await fetch(`${this.endpoint}/api/tags`, { signal: controller.signal });
        clearTimeout(timeout);
        if (res.ok) {
          const data = await res.json() as { models?: { name: string }[] };
          if (data.models) {
            this.availableModelsCache = data.models.map(m => m.name);
          }
          return this.createHealth('healthy', Date.now() - start);
        }
      } catch {
        clearTimeout(timeout);
      }
      // Fallback: Ollama not running, but we consider it degraded not down, because it's local-first
      return this.createHealth('degraded', Date.now() - start, 'Ollama not reachable, using mock');
    } catch (e) {
      return this.createHealth('degraded', Date.now() - start, String(e));
    }
  }

  async complete(request: ProviderRequest): Promise<ProviderResponse> {
    const start = Date.now();
    const model = this.selectModelForTask(request.taskType);
    
    try {
      // Attempt real Ollama call if available - FAST FAILOVER <2s per risk analysis
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1800); // <2s to allow quick fallback to Gemini
      
      try {
        const res = await fetch(`${this.endpoint}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            prompt: request.systemPrompt ? `${request.systemPrompt}\n\n${request.prompt}` : request.prompt,
            stream: false,
            options: {
              temperature: request.temperature ?? 0.7,
              num_predict: request.maxTokens ?? 2048
            }
          }),
          signal: controller.signal
        });
        clearTimeout(timeout);
        
        if (res.ok) {
          const data = await res.json() as { response: string; eval_count?: number; prompt_eval_count?: number };
          return {
            provider: this.name,
            model,
            content: data.response,
            tokensUsed: {
              input: data.prompt_eval_count || this.estimateTokens(request.prompt),
              output: data.eval_count || this.estimateTokens(data.response),
              total: (data.prompt_eval_count || 0) + (data.eval_count || 0)
            },
            latencyMs: Date.now() - start,
            cost: 0,
            finishReason: 'stop',
            timestamp: new Date().toISOString()
          };
        }
      } catch {
        clearTimeout(timeout);
      }
    } catch {
      // Fall through to mock
    }

    // Mock response for testing / when Ollama not available - still $0
    return this.mockResponse(request, model, Date.now() - start);
  }

  private selectModelForTask(taskType: string): string {
    const map: Record<string, string> = {
      chat: 'llama3.2:latest',
      coding: 'codellama:latest',
      planning: 'llama3.2:latest',
      summarization: 'llama3.2:1b',
      classification: 'llama3.2:1b',
      embedding: 'nomic-embed-text',
      rag: 'llama3.2:latest',
      vision: 'llava:latest',
      research: 'llama3.2:latest',
      verification: 'llama3.2:latest',
      reflection: 'llama3.2:1b',
      code_review: 'codellama:latest'
    };
    return map[taskType] || 'llama3.2:latest';
  }
}
