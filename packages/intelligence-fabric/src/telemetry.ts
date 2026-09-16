/**
 * Provider Telemetry & Learning
 */

import type { ProviderTelemetry, ProviderName, TaskType } from './types.js';

export class ProviderTelemetryStore {
  private telemetry: ProviderTelemetry[] = [];
  private maxSize = 10000;

  record(entry: ProviderTelemetry): void {
    this.telemetry.push(entry);
    if (this.telemetry.length > this.maxSize) {
      this.telemetry = this.telemetry.slice(-this.maxSize);
    }
  }

  getStats(provider?: ProviderName, taskType?: TaskType): {
    totalRequests: number;
    successRate: number;
    avgLatency: number;
    totalCost: number;
    totalTokens: number;
    byProvider: Record<string, { count: number; successRate: number; avgLatency: number }>;
    byTask: Record<string, { count: number; successRate: number }>;
  } {
    let filtered = this.telemetry;
    if (provider) filtered = filtered.filter(t => t.provider === provider);
    if (taskType) filtered = filtered.filter(t => t.taskType === taskType);

    const totalRequests = filtered.length;
    const successes = filtered.filter(t => t.success).length;
    const successRate = totalRequests > 0 ? successes / totalRequests : 0;
    const avgLatency = totalRequests > 0 ? filtered.reduce((sum, t) => sum + t.latencyMs, 0) / totalRequests : 0;
    const totalCost = filtered.reduce((sum, t) => sum + t.cost, 0);
    const totalTokens = filtered.reduce((sum, t) => sum + t.tokens, 0);

    const byProvider: Record<string, { count: number; successRate: number; avgLatency: number }> = {};
    const byTask: Record<string, { count: number; successRate: number }> = {};

    // Group by provider
    const providers = [...new Set(filtered.map(t => t.provider))];
    for (const p of providers) {
      const pData = filtered.filter(t => t.provider === p);
      byProvider[p] = {
        count: pData.length,
        successRate: pData.length > 0 ? pData.filter(t => t.success).length / pData.length : 0,
        avgLatency: pData.length > 0 ? pData.reduce((s, t) => s + t.latencyMs, 0) / pData.length : 0
      };
    }

    // Group by task
    const tasks = [...new Set(filtered.map(t => t.taskType))];
    for (const task of tasks) {
      const tData = filtered.filter(t => t.taskType === task);
      byTask[task] = {
        count: tData.length,
        successRate: tData.length > 0 ? tData.filter(t => t.success).length / tData.length : 0
      };
    }

    return {
      totalRequests,
      successRate,
      avgLatency,
      totalCost,
      totalTokens,
      byProvider,
      byTask
    };
  }

  getProviderRanking(taskType: TaskType): { provider: ProviderName; score: number; successRate: number; avgLatency: number }[] {
    const taskTelemetry = this.telemetry.filter(t => t.taskType === taskType);
    const providers = [...new Set(taskTelemetry.map(t => t.provider))] as ProviderName[];

    return providers.map(provider => {
      const data = taskTelemetry.filter(t => t.provider === provider);
      const successRate = data.length > 0 ? data.filter(t => t.success).length / data.length : 0;
      const avgLatency = data.length > 0 ? data.reduce((s, t) => s + t.latencyMs, 0) / data.length : 9999;
      const avgQuality = data.filter(t => t.quality !== undefined).reduce((s, t) => s + (t.quality || 0), 0) / Math.max(1, data.filter(t => t.quality !== undefined).length);
      
      // Score: higher success + lower latency + higher quality
      // Latency normalized: 0-1 where lower latency = higher score
      const latencyScore = Math.max(0, 1 - avgLatency / 10000);
      const score = successRate * 0.5 + latencyScore * 0.3 + (avgQuality || 0.5) * 0.2;

      return {
        provider,
        score,
        successRate,
        avgLatency
      };
    }).sort((a, b) => b.score - a.score);
  }

  getRecent(limit = 100): ProviderTelemetry[] {
    return this.telemetry.slice(-limit).reverse();
  }

  clear(): void {
    this.telemetry = [];
  }

  export(): ProviderTelemetry[] {
    return [...this.telemetry];
  }
}

export const telemetryStore = new ProviderTelemetryStore();
export default ProviderTelemetryStore;
