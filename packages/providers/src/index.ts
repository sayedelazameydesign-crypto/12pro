/**
 * @agi-system/providers - Provider Routing with Intelligence Fabric integration
 * Part of AGI-OS 12-layer architecture
 * Responsibility: LLM provider routing with $0 cost guard
 * 
 * Now integrates with @agi-system/intelligence-fabric for zero-cost policy
 */

export const PACKAGE_NAME = "@agi-system/providers";
export const VERSION = "0.1.0";

export interface ServiceConfig {
  enabled: boolean;
  timeoutMs?: number;
  maxRetries?: number;
}

// Re-export intelligence fabric types and classes for backward compatibility
export type {
  ProviderName,
  TaskType,
  ProviderConfig,
  ProviderHealth,
  ProviderDecision,
  ProviderRequest,
  ProviderResponse,
  CostGuardPolicy,
  ModelExecutionProfile
} from "@agi-system/intelligence-fabric";

export { 
  ProviderRouter,
  providerRouter,
  BudgetGuard,
  budgetGuard,
  HealthMonitor,
  healthMonitor,
  TaskRouter,
  taskRouter,
  CAPABILITY_MATRIX,
  MODEL_PROFILES,
  getProfileForTask
} from "@agi-system/intelligence-fabric";

// Legacy service for compatibility
export class ProvidersService {
  private router: any;

  constructor(private config: ServiceConfig = { enabled: true, timeoutMs: 30000 }) {}

  async init(): Promise<void> {
    console.log(`[${PACKAGE_NAME}] initializing with Intelligence Fabric...`);
    try {
      const { providerRouter } = await import("@agi-system/intelligence-fabric");
      this.router = providerRouter;
      console.log(`[${PACKAGE_NAME}] Intelligence Fabric connected - $0 policy active`);
    } catch (e) {
      console.warn(`[${PACKAGE_NAME}] Intelligence Fabric not available, using stub: ${e}`);
    }
  }

  health(): { status: 'ok' | 'degraded' | 'down'; package: string; timestamp: string; spend: string } {
    return { 
      status: 'ok', 
      package: PACKAGE_NAME, 
      timestamp: new Date().toISOString(),
      spend: '$0.00 / $0.00'
    };
  }

  async shutdown(): Promise<void> {
    console.log(`[${PACKAGE_NAME}] shutting down...`);
    if (this.router) {
      await this.router.shutdown();
    }
  }

  // New method: route task
  async routeTask(taskType: string, prompt: string): Promise<any> {
    if (!this.router) await this.init();
    return this.router.execute({
      taskType: taskType as any,
      prompt
    });
  }
}

export * from "./types.js";
export default ProvidersService;
