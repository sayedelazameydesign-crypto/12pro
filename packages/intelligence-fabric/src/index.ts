/**
 * @agi-system/intelligence-fabric - Zero-Cost Intelligence Fabric
 * 
 * CeliaOS / Nawah - Local-First + Free Cloud Fallback + Budget Guard = $0
 * 
 * Architecture:
 *                Intelligence Fabric
 *                       │
 *       ┌───────────────┼────────────────┐
 *       │               │                │
 *   Model Router    Task Router       Cost Guard
 *       │               │                │
 *       └───────────────┼────────────────┘
 *                       │
 *                 Provider Router
 *                       │
 *       ┌────────┬──────┼──────┬────────┐
 *       ▼        ▼      ▼      ▼        ▼
 *    Ollama   Gemini  NVIDIA  Groq     HF
 *       │
 *       ▼
 *     $0 core
 */

export * from './types.js';
export * from './providers/base.js';
export * from './providers/ollama.js';
export * from './providers/gemini.js';
export * from './providers/nvidia.js';
export * from './providers/groq.js';
export * from './providers/hf.js';
export * from './budget-guard.js';
export * from './capability-matrix.js';
export * from './health.js';
export * from './telemetry.js';
export * from './task-router.js';
export * from './router.js';

// Main exports
import { ProviderRouter, providerRouter } from './router.js';
import { BudgetGuard, budgetGuard } from './budget-guard.js';
import { HealthMonitor, healthMonitor } from './health.js';
import { TaskRouter, taskRouter } from './task-router.js';
import { ProviderTelemetryStore, telemetryStore } from './telemetry.js';
import { CAPABILITY_MATRIX, MODEL_PROFILES, getRoutingRules, getProfileForTask } from './capability-matrix.js';

export const PACKAGE_NAME = '@agi-system/intelligence-fabric';
export const VERSION = '0.1.0';

export const intelligenceFabric = {
  router: providerRouter,
  budgetGuard,
  healthMonitor,
  taskRouter,
  telemetry: telemetryStore,
  capabilityMatrix: CAPABILITY_MATRIX,
  modelProfiles: MODEL_PROFILES,
  
  // Factory methods
  createRouter: (config?: ConstructorParameters<typeof ProviderRouter>[0]) => new ProviderRouter(config),
  createBudgetGuard: () => new BudgetGuard(),
  createHealthMonitor: () => new HealthMonitor(),
  
  // Utilities
  getRoutingRules,
  getProfileForTask,
  
  // Config
  config: {
    maxSpendUsd: 0,
    localFirst: true,
    blockUnknownCost: true,
    providers: {
      ollama: { enabled: true, priority: 1, costLimit: 0, freeOnly: true },
      gemini: { enabled: true, priority: 2, costLimit: 0, freeOnly: true },
      nvidia: { enabled: true, priority: 3, costLimit: 0, freeOnly: true },
      groq: { enabled: true, priority: 4, costLimit: 0, freeOnly: true },
      huggingface: { enabled: true, priority: 5, costLimit: 0, freeOnly: true }
    }
  }
};

export default intelligenceFabric;

console.log(`[${PACKAGE_NAME}] v${VERSION} - Intelligence Fabric initialized with $0 policy`);
