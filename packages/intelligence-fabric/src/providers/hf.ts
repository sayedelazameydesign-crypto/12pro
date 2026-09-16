import { BaseProvider } from './base.js';
import type { ProviderHealth, ProviderRequest, ProviderResponse, ProviderName } from '../types.js';

export class HuggingFaceProvider extends BaseProvider {
  readonly name: ProviderName = 'huggingface';
  readonly isLocal = false;
  private apiKey?: string;
  private availableModelsCache = [
    'sentence-transformers/all-MiniLM-L6-v2',
    'BAAI/bge-small-en-v1.5',
    'microsoft/codebert-base',
    'facebook/bart-large-mnli',
    'cardiffnlp/twitter-roberta-base-sentiment'
  ];

  constructor(apiKey?: string) {
    super();
    this.apiKey = apiKey || process.env.HF_API_KEY || process.env.HUGGINGFACE_API_KEY;
  }

  getAvailableModels(): string[] {
    return this.availableModelsCache;
  }

  async checkHealth(): Promise<ProviderHealth> {
    const start = Date.now();
    if (!this.apiKey) {
      return this.createHealth('degraded', Date.now() - start, 'HF_API_KEY not configured - free $0.10 quota not available');
    }
    return {
      provider: this.name,
      status: 'healthy',
      latencyMs: Date.now() - start,
      lastCheck: new Date().toISOString(),
      availableModels: this.availableModelsCache,
      isLocal: false,
      quotaRemaining: 100 // $0.10 worth of inference
    };
  }

  async complete(request: ProviderRequest): Promise<ProviderResponse> {
    const start = Date.now();
    
    // HF is best for specialized tasks like embeddings, classification, not general chat
    // For chat tasks, we should prefer other providers
    if (['embedding', 'classification', 'summarization'].includes(request.taskType)) {
      // Specialized inference
      if (!this.apiKey) {
        // Return mock embedding/classification result with $0 cost
        return {
          provider: this.name,
          model: this.selectModelForTask(request.taskType),
          content: JSON.stringify(this.mockSpecializedResult(request)),
          tokensUsed: { input: this.estimateTokens(request.prompt), output: 10, total: this.estimateTokens(request.prompt) + 10 },
          latencyMs: Date.now() - start,
          cost: 0,
          finishReason: 'stop',
          timestamp: new Date().toISOString()
        };
      }

      try {
        const model = this.selectModelForTask(request.taskType);
        const res = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ inputs: request.prompt })
        });

        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`HF API error ${res.status}: ${txt}`);
        }

        const data = await res.json();
        return {
          provider: this.name,
          model,
          content: JSON.stringify(data),
          tokensUsed: { input: this.estimateTokens(request.prompt), output: 20, total: this.estimateTokens(request.prompt) + 20 },
          latencyMs: Date.now() - start,
          cost: 0,
          finishReason: 'stop',
          timestamp: new Date().toISOString()
        };
      } catch (e) {
        throw e;
      }
    } else {
      // For non-specialized tasks, HF is not preferred - throw to trigger fallback
      throw new Error(`HF not optimal for task ${request.taskType}, fallback to other provider`);
    }
  }

  private selectModelForTask(taskType: string): string {
    const map: Record<string, string> = {
      embedding: 'sentence-transformers/all-MiniLM-L6-v2',
      classification: 'facebook/bart-large-mnli',
      summarization: 'facebook/bart-large-cnn',
      coding: 'microsoft/codebert-base',
      chat: 'microsoft/DialoGPT-medium'
    };
    return map[taskType] || 'sentence-transformers/all-MiniLM-L6-v2';
  }

  private mockSpecializedResult(request: ProviderRequest): any {
    if (request.taskType === 'embedding') {
      // Mock 384-dim embedding
      return Array.from({ length: 384 }, () => Math.random() * 2 - 1);
    }
    if (request.taskType === 'classification') {
      return { labels: ['positive', 'neutral', 'negative'], scores: [0.7, 0.2, 0.1] };
    }
    if (request.taskType === 'summarization') {
      return { summary: request.prompt.slice(0, 100) + '...' };
    }
    return { result: 'mock specialized result' };
  }
}
