/**
 * @agi-system/kernel - Atomic Core Kernel
 * 
 * النواة الكودية النووية الذرية - أصغر مجموعة primitives غير قابلة للتجاوز
 * 
 * IDENTITY + STATE + COMMAND + POLICY + EVENT + EXECUTION + PERSISTENCE
 * Who? What state? What requested? Is it allowed? What happened? What was executed? Was it saved?
 * 
 * Properties:
 * - Typed + Deterministic + Immutable Events + Explicit State Machine + Policy Enforcement + Persistence + Recovery + Auditability + Testability + Isolation + Versioned + Composable + Observable + Recoverable
 * 
 * What is NOT in kernel:
 * - React, Next.js, HTTP routes, UI
 * - LLM SDKs (Anthropic, Gemini, Ollama implementation)
 * - Browser automation
 * - GitHub UI
 * - SQLite-specific queries
 * - Prompt templates
 * 
 * Instead: Core -> interfaces/contracts -> Adapters -> Ollama/Gemini/Groq/Browser/GitHub/SQLite/Qdrant
 */

// Core exports - Atomic primitives
export * from './types.js';

// Kernel
export { AtomicKernel, kernel, createKernel } from './kernel.js';
export type { CoreKernel, KernelConfig } from './kernel.js';

// Identity
export * from './identity/identity.js';

// Context
export * from './context/execution-context.js';

// State
export * from './state/machine.js';
export * from './state/reducer.js';

// Events
export * from './events/event.js';
export * from './events/event-store.js';

// Commands
export * from './commands/command.js';

// Policy
export * from './policy/policy.js';
export * from './policy/authorization.js';

// Execution
export * from './execution/executor.js';
export * from './execution/result.js';

// Persistence
export * from './persistence/repository.js';

// Errors
export * from './errors/core-error.js';

// Invariants
export * from './invariants/invariants.js';

// Version
export const KERNEL_VERSION = '0.1.0';
export const PACKAGE_NAME = '@agi-system/kernel';

// Dependency graph - ما يعتمد على ماذا
export const DEPENDENCY_GRAPH = {
  // Level 0 - No dependencies (pure)
  level0: ['identity', 'context/clock', 'errors'],
  // Level 1 - Depends on Level 0
  level1: ['state/machine', 'events/event', 'commands/command'],
  // Level 2 - Depends on Level 1
  level2: ['state/reducer', 'events/event-store', 'policy/policy', 'execution/result', 'persistence/repository'],
  // Level 3 - Depends on Level 2
  level3: ['policy/authorization', 'execution/executor', 'invariants'],
  // Level 4 - Top - Depends on all
  level4: ['kernel']
};

console.log(`[${PACKAGE_NAME}] v${KERNEL_VERSION} - Atomic Core Kernel initialized`);
