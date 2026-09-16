/**
 * Provider Router - Main Intelligence Fabric Router
 * Implements: Local-First + Free Cloud Fallback + Budget Guard = $0
 */

import type { ProviderName, ProviderRequest, ProviderResponse, ProviderDecision, TaskType } from './types.js';
import { BaseProvider } from './providers/base.js';
import { OllamaProvider } from './providers/ollama.js';
import { GeminiProvider } from './providers/gemini.js';
import { NvidiaProvider } from './providers/nvidia.js';
import { GroqProvider } from './providers/groq.js';
import { HuggingFaceProvider } from './providers/hf.js';
import { BudgetGuard } from './budget-guard.js';
import { HealthMonitor } from './health.js';
import { TaskRouter } from './task-router.js';
import { ProviderTelemetryStore } from './telemetry.js';
import { getProfileForTask } from './capability-matrix.js';

export interface RouterConfig {
  maxSpendUsd?: number;
  enableHealthCheck?: boolean;
  healthCheckIntervalMs?: number;
  enableTelemetry?: boolean;
}

export class ProviderRouter {
  private providers: Map<ProviderName, BaseProvider> = new Map();
  private budgetGuard: BudgetGuard;
  private healthMonitor: HealthMonitor;
  private taskRouter: TaskRouter;
  private telemetry: ProviderTelemetryStore;
  private config: RouterConfig;

  constructor(config: RouterConfig = {}) {
    this.config = {
      maxSpendUsd: 0,
      enableHealthCheck: true,
      healthCheckIntervalMs: 30000,
      enableTelemetry: true,
      ...config
    };

    this.budgetGuard = new BudgetGuard({ maxSpendUsd: this.config.maxSpendUsd! });
    this.healthMonitor = new HealthMonitor(this.config.healthCheckIntervalMs);
    this.taskRouter = new TaskRouter();
    this.telemetry = new ProviderTelemetryStore();

    // Register all providers
    this.registerProvider(new OllamaProvider());
    this.registerProvider(new GeminiProvider());
    this.registerProvider(new NvidiaProvider());
    this.registerProvider(new GroqProvider());
    this.registerProvider(new HuggingFaceProvider());

    if (this.config.enableHealthCheck) {
      this.healthMonitor.startPeriodicChecks();
      // Initial health check
      this.healthMonitor.checkAll().catch(console.error);
    }
  }

  registerProvider(provider: BaseProvider): void {
    this.providers.set(provider.name, provider);
    this.healthMonitor.registerProvider(provider);
  }

  /**
   * Main routing decision - which provider to use?
   */
  decide(request: ProviderRequest): ProviderDecision {
    const taskRouting = this.taskRouter.routeTask(request.taskType, {
      requiresVision: request.requiresVision,
      requiresTools: request.requiresTools,
      requiresLongContext: request.requiresLongContext
    });

    const profile = getProfileForTask(request.taskType);
    
    // Check health - prefer healthy providers
    const healthyProviders = this.healthMonitor.getHealthyProviders();
    let primary = taskRouting.primary;
    
    if (healthyProviders.length > 0 && !healthyProviders.includes(primary)) {
      // Primary not healthy, try fallbacks that are healthy
      const healthyFallback = taskRouting.fallbacks.find(f => healthyProviders.includes(f));
      if (healthyFallback) {
        primary = healthyFallback;
      } else if (healthyProviders.includes('ollama')) {
        // Always fallback to local if available
        primary = 'ollama';
      }
    }

    const decision: ProviderDecision = {
      provider: primary,
      model: profile.model,
      reason: taskRouting.reason,
      estimatedCost: 0, // All our providers are $0 under policy
      taskType: request.taskType,
      fallbackChain: taskRouting.fallbacks,
      confidence: 0.9
    };

    return decision;
  }

  /**
   * Execute with automatic fallback
   */
  async execute(request: ProviderRequest): Promise<ProviderResponse> {
    const decision = this.decide(request);
    
    // Budget guard check
    const guardCheck = this.budgetGuard.check(decision);
    if (!guardCheck.allowed) {
      throw new Error(`Budget Guard blocked: ${guardCheck.reason}`);
    }

    const providersToTry = [decision.provider, ...decision.fallbackChain];
    let lastError: Error | null = null;

    for (const providerName of providersToTry) {
      const provider = this.providers.get(providerName);
      if (!provider) continue;

      // Check if provider is allowed by budget
      const check = this.budgetGuard.check({
        ...decision,
        provider: providerName
      });
      if (!check.allowed) {
        console.log(`[router] Skipping ${providerName}: ${check.reason}`);
        continue;
      }

      try {
        const start = Date.now();
        const response = await provider.complete(request);
        const latency = Date.now() - start;

        // Validate cost is still 0
        if (response.cost > 0 && this.config.maxSpendUsd === 0) {
          throw new Error(`Provider ${providerName} returned cost $${response.cost} but MAX_SPEND=0`);
        }

        // Record telemetry
        if (this.config.enableTelemetry) {
          this.telemetry.record({
            provider: providerName,
            taskType: request.taskType,
            latencyMs: latency,
            success: true,
            cost: response.cost,
            tokens: response.tokensUsed.total,
            timestamp: new Date().toISOString(),
            model: response.model
          });
        }

        this.budgetGuard.recordUsage(providerName, response.cost);

        console.log(`[router] Success with ${providerName}/${response.model} for ${request.taskType} in ${latency}ms`);
        return response;

      } catch (e) {
        lastError = e as Error;
        console.warn(`[router] Provider ${providerName} failed for ${request.taskType}: ${e}`);

        if (this.config.enableTelemetry) {
          this.telemetry.record({
            provider: providerName,
            taskType: request.taskType,
            latencyMs: 0,
            success: false,
            cost: 0,
            tokens: 0,
            timestamp: new Date().toISOString(),
            model: 'unknown',
            error: String(e)
          });
        }

        // Continue to next provider
        continue;
      }
    }

    throw new Error(`All providers failed for task ${request.taskType}. Last error: ${lastError?.message}`);
  }

  /**
   * Streaming execution (for chat)
   */
  async *executeStream(request: ProviderRequest): AsyncGenerator<{ provider: ProviderName; chunk: string; done: boolean }, void, unknown> {
    const decision = this.decide(request);
    const guardCheck = this.budgetGuard.check(decision);
    if (!guardCheck.allowed) {
      throw new Error(`Budget Guard blocked streaming: ${guardCheck.reason}`);
    }

    const provider = this.providers.get(decision.provider);
    if (!provider) throw new Error(`Provider ${decision.provider} not found`);

    try {
      const response = await provider.complete(request);
      // Simulate streaming by chunking response
      const chunks = this.chunkText(response.content, 20);
      for (const chunk of chunks) {
        yield { provider: decision.provider, chunk, done: false };
        await new Promise(r => setTimeout(r, 30)); // Simulate streaming delay
      }
      yield { provider: decision.provider, chunk: '', done: true };
    } catch (e) {
      throw e;
    }
  }

  private chunkText(text: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.slice(i, i + chunkSize));
    }
    return chunks;
  }

  getHealth() {
    return this.healthMonitor.getAllHealth();
  }

  getBudgetStatus() {
    return this.budgetGuard.getStatus();
  }

  getTelemetry() {
    return this.telemetry;
  }

  getTaskRouter() {
    return this.taskRouter;
  }

  async shutdown(): Promise<void> {
    this.healthMonitor.stopPeriodicChecks();
  }
}

export const providerRouter = new ProviderRouter();
export default ProviderRouter;
