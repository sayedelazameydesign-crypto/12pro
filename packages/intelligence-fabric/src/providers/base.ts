import type { ProviderName, ProviderHealth, ProviderRequest, ProviderResponse, HealthStatus } from '../types.js';

export abstract class BaseProvider {
  abstract readonly name: ProviderName;
  abstract readonly isLocal: boolean;

  protected healthStatus: HealthStatus = 'unknown';
  protected lastCheck = new Date().toISOString();

  abstract checkHealth(): Promise<ProviderHealth>;
  abstract complete(request: ProviderRequest): Promise<ProviderResponse>;
  abstract getAvailableModels(): string[];

  protected createHealth(status: HealthStatus, latencyMs?: number, error?: string): ProviderHealth {
    this.healthStatus = status;
    this.lastCheck = new Date().toISOString();
    return {
      provider: this.name,
      status,
      latencyMs,
      lastCheck: this.lastCheck,
      error,
      availableModels: this.getAvailableModels(),
      isLocal: this.isLocal
    };
  }

  protected estimateTokens(text: string): number {
    // Rough estimation: 1 token ~ 4 chars
    return Math.ceil(text.length / 4);
  }

  protected mockResponse(request: ProviderRequest, model: string, latencyMs = 100): ProviderResponse {
    const inputTokens = this.estimateTokens(request.prompt + (request.systemPrompt || ''));
    const outputTokens = this.estimateTokens(`Response to: ${request.prompt.slice(0, 100)}`);
    return {
      provider: this.name,
      model,
      content: `[${this.name}/${model}] Mock response for task ${request.taskType}: ${request.prompt.slice(0, 200)}`,
      tokensUsed: { input: inputTokens, output: outputTokens, total: inputTokens + outputTokens },
      latencyMs,
      cost: 0,
      finishReason: 'stop',
      timestamp: new Date().toISOString()
    };
  }
}
