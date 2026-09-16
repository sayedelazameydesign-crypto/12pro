/**
 * Health Monitor for Providers
 */

import type { ProviderHealth, ProviderName, HealthStatus } from './types.js';
import { BaseProvider } from './providers/base.js';

export class HealthMonitor {
  private providers: Map<ProviderName, BaseProvider> = new Map();
  private healthCache: Map<ProviderName, ProviderHealth> = new Map();
  private checkIntervalMs: number;
  private intervalId?: NodeJS.Timeout;

  constructor(checkIntervalMs = 30000) {
    this.checkIntervalMs = checkIntervalMs;
  }

  registerProvider(provider: BaseProvider): void {
    this.providers.set(provider.name, provider);
    console.log(`[health-monitor] Registered provider ${provider.name}`);
  }

  async checkAll(): Promise<Record<ProviderName, ProviderHealth>> {
    const results: Record<string, ProviderHealth> = {};
    
    for (const [name, provider] of this.providers.entries()) {
      try {
        const health = await provider.checkHealth();
        this.healthCache.set(name, health);
        results[name] = health;
      } catch (e) {
        const failedHealth: ProviderHealth = {
          provider: name,
          status: 'down' as HealthStatus,
          lastCheck: new Date().toISOString(),
          error: String(e),
          availableModels: [],
          isLocal: provider.isLocal
        };
        this.healthCache.set(name, failedHealth);
        results[name] = failedHealth;
      }
    }

    return results as Record<ProviderName, ProviderHealth>;
  }

  async checkProvider(name: ProviderName): Promise<ProviderHealth | null> {
    const provider = this.providers.get(name);
    if (!provider) return null;
    
    try {
      const health = await provider.checkHealth();
      this.healthCache.set(name, health);
      return health;
    } catch (e) {
      const failedHealth: ProviderHealth = {
        provider: name,
        status: 'down',
        lastCheck: new Date().toISOString(),
        error: String(e),
        availableModels: [],
        isLocal: provider.isLocal
      };
      this.healthCache.set(name, failedHealth);
      return failedHealth;
    }
  }

  getHealth(name: ProviderName): ProviderHealth | undefined {
    return this.healthCache.get(name);
  }

  getAllHealth(): Record<ProviderName, ProviderHealth> {
    const result: Record<string, ProviderHealth> = {};
    for (const [name, health] of this.healthCache.entries()) {
      result[name] = health;
    }
    return result as Record<ProviderName, ProviderHealth>;
  }

  getHealthyProviders(): ProviderName[] {
    const healthy: ProviderName[] = [];
    for (const [name, health] of this.healthCache.entries()) {
      if (health.status === 'healthy' || health.status === 'degraded') {
        healthy.push(name);
      }
    }
    return healthy;
  }

  startPeriodicChecks(): void {
    if (this.intervalId) return;
    
    this.intervalId = setInterval(async () => {
      await this.checkAll();
    }, this.checkIntervalMs);

    console.log(`[health-monitor] Started periodic checks every ${this.checkIntervalMs}ms`);
  }

  stopPeriodicChecks(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      console.log('[health-monitor] Stopped periodic checks');
    }
  }

  getOverallStatus(): { status: HealthStatus; healthyCount: number; totalCount: number; localAvailable: boolean } {
    const all = Array.from(this.healthCache.values());
    const healthy = all.filter(h => h.status === 'healthy' || h.status === 'degraded').length;
    const localHealthy = all.some(h => h.isLocal && (h.status === 'healthy' || h.status === 'degraded'));
    
    let overall: HealthStatus = 'healthy';
    if (healthy === 0) overall = 'down';
    else if (healthy < all.length) overall = 'degraded';
    
    return {
      status: overall,
      healthyCount: healthy,
      totalCount: all.length,
      localAvailable: localHealthy
    };
  }
}

export const healthMonitor = new HealthMonitor();
export default HealthMonitor;
